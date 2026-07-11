"""Tests for Phase 12: Model Merging Enhancement — Sens-Merging, AIM, Dynamic Merging."""

import pytest
import os
import sys
import sqlite3

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from phaos.main import app
from phaos.db.database import init_db
from phaos.core.integration.sens_merging import SensMerging
from phaos.core.integration.activation_merging import ActivationInformedMerging
from phaos.core.integration.merge_optimizer import MergeOptimizer, reset_merge_optimizer
from phaos.core.integration.model_merging import ModelMerger, reset_model_merger, STRATEGIES, TASK_TO_MODELS

_test_counter = 0


@pytest.fixture(autouse=True)
def client():
    global _test_counter
    _test_counter += 1
    db_path = f"./test_merging_{_test_counter}.db"
    import phaos.db.database as db_mod
    db_mod._db = None
    init_db(db_path)
    reset_merge_optimizer()
    reset_model_merger()
    with TestClient(app) as c:
        yield c
    import phaos.db.database as db_mod
    db_mod._db = None
    try:
        os.remove(db_path)
    except OSError:
        pass


def _make_callback(responses):
    idx = [0]

    def cb(q):
        i = idx[0] % len(responses)
        idx[0] += 1
        return responses[i]

    return cb


# ── Sens-Merging ─────────────────────────────────────────────────


class TestSensMerging:
    def test_compute_sensitivity(self):
        sm = SensMerging()
        callback = _make_callback(["response A", "response B", "response C"])
        scores = sm.compute_sensitivity(callback, ["input1", "input2", "input3"])
        assert "default" in scores
        assert scores["default"] > 0

    def test_merge_returns_callback(self):
        sm = SensMerging()
        models = {
            "m1": _make_callback(["result1"]),
            "m2": _make_callback(["result2"]),
        }
        merged = sm.merge(models, query="test")
        assert callable(merged)

    def test_merge_produces_result(self):
        sm = SensMerging()
        models = {
            "m1": _make_callback(["hello"]),
            "m2": _make_callback(["world"]),
        }
        merged = sm.merge(models, query="test")
        result = merged("test")
        assert result is not None

    def test_merge_with_empty_models(self):
        sm = SensMerging()
        merged = sm.merge({}, query="test")
        result = merged("test")
        assert result is None

    def test_merge_with_manual_weights(self):
        sm = SensMerging()
        models = {
            "m1": _make_callback(["first"]),
            "m2": _make_callback(["second"]),
        }
        merged = sm.merge(models, weights={"m1": 0.9, "m2": 0.1}, query="test")
        result = merged("test")
        assert result == "first"

    def test_merge_with_sensitivity(self):
        sm = SensMerging()
        models = {
            "m1": _make_callback(["alpha"]),
            "m2": _make_callback(["beta"]),
        }
        merged = sm.merge(models, sensitivity={"m1": 0.8, "m2": 0.2}, query="test")
        result = merged("test")
        assert result is not None

    def test_merge_handles_model_failure(self):
        sm = SensMerging()

        def failing_cb(q):
            raise RuntimeError("model failed")

        models = {
            "m1": failing_cb,
            "m2": _make_callback(["fallback"]),
        }
        merged = sm.merge(models, query="test")
        result = merged("test")
        assert result == "fallback"


# ── Activation-Informed Merging ──────────────────────────────────


class TestActivationMerging:
    def test_compute_activations(self):
        aim = ActivationInformedMerging()
        callback = _make_callback(["out A", "out B", "out C"])
        scores = aim.compute_activations(callback, ["in1", "in2", "in3"])
        assert "default" in scores
        assert scores["default"] > 0

    def test_merge_returns_callback(self):
        aim = ActivationInformedMerging()
        models = {
            "m1": _make_callback(["r1"]),
            "m2": _make_callback(["r2"]),
        }
        merged = aim.merge(models, query="test")
        assert callable(merged)

    def test_merge_produces_result(self):
        aim = ActivationInformedMerging()
        models = {
            "m1": _make_callback(["hello"]),
            "m2": _make_callback(["world"]),
        }
        merged = aim.merge(models, query="test")
        result = merged("test")
        assert result is not None

    def test_merge_with_empty_models(self):
        aim = ActivationInformedMerging()
        merged = aim.merge({}, query="test")
        result = merged("test")
        assert result is None

    def test_merge_with_activation_mask(self):
        aim = ActivationInformedMerging()
        models = {
            "m1": _make_callback(["alpha"]),
            "m2": _make_callback(["beta"]),
        }
        mask = {"m1": {"default": 0.9}, "m2": {"default": 0.1}}
        merged = aim.merge(models, activation_mask=mask, query="test")
        result = merged("test")
        assert result == "alpha"

    def test_merge_handles_model_failure(self):
        aim = ActivationInformedMerging()

        def failing_cb(q):
            raise RuntimeError("boom")

        models = {
            "m1": failing_cb,
            "m2": _make_callback(["safe"]),
        }
        merged = aim.merge(models, query="test")
        result = merged("test")
        assert result == "safe"


# ── Merge Optimizer ──────────────────────────────────────────────


class TestMergeOptimizer:
    def test_record_and_retrieve(self):
        db = sqlite3.connect(":memory:")
        opt = MergeOptimizer(db)
        opt.record_strategy_usage("coding", "sens_merging", ["m1"], True, 100.0, 500)
        records = opt.get_merge_records("coding")
        assert len(records) == 1
        assert records[0]["strategy_name"] == "sens_merging"
        assert records[0]["success"] == 1
        db.close()

    def test_get_best_strategy(self):
        db = sqlite3.connect(":memory:")
        opt = MergeOptimizer(db)
        for _ in range(5):
            opt.record_strategy_usage("coding", "sens_merging", ["m1"], True, 80.0, 400)
        for _ in range(5):
            opt.record_strategy_usage("coding", "simple_average", ["m1"], True, 200.0, 600)
        best = opt.get_best_strategy("coding", min_samples=3)
        assert best is not None
        assert best["strategy"] == "sens_merging"
        assert best["success_rate"] == 1.0
        db.close()

    def test_get_best_strategy_no_data(self):
        db = sqlite3.connect(":memory:")
        opt = MergeOptimizer(db)
        best = opt.get_best_strategy("nonexistent")
        assert best is None
        db.close()

    def test_get_all_strategy_scores(self):
        db = sqlite3.connect(":memory:")
        opt = MergeOptimizer(db)
        opt.record_strategy_usage("coding", "sens_merging", ["m1"], True, 100.0, 500)
        opt.record_strategy_usage("coding", "activation_informed", ["m1"], False, 150.0, 600)
        scores = opt.get_all_strategy_scores("coding")
        assert len(scores) == 2
        assert scores[0]["success_rate"] >= scores[1]["success_rate"]
        db.close()

    def test_min_samples_filter(self):
        db = sqlite3.connect(":memory:")
        opt = MergeOptimizer(db)
        opt.record_strategy_usage("coding", "rare_strategy", ["m1"], True, 100.0, 500)
        best = opt.get_best_strategy("coding", min_samples=5)
        assert best is None
        db.close()


# ── ModelMerger (updated) ────────────────────────────────────────


class TestModelMergerUpdated:
    def test_register_and_status(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.register_model("coding", lambda q: "code", "coding")
        status = merger.get_status()
        assert "coding" in status["registered_models"]
        assert "available_strategies" in status

    def test_set_strategy_for_task(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.set_strategy_for_task("coding", "sens_merging")
        assert merger.task_strategies["coding"] == "sens_merging"

    def test_set_invalid_strategy(self):
        merger = ModelMerger({"model_merging_enabled": True})
        with pytest.raises(ValueError):
            merger.set_strategy_for_task("coding", "invalid_strategy")

    def test_get_strategy_for_task_default(self):
        merger = ModelMerger({"model_merging_enabled": True, "merge_method": "simple_average"})
        strategy = merger.get_strategy_for_task("coding")
        assert strategy == "simple_average"

    def test_get_strategy_for_task_configured(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.task_strategies["coding"] = "sens_merging"
        strategy = merger.get_strategy_for_task("coding")
        assert strategy == "sens_merging"

    def test_merge_for_task_sens(self):
        merger = ModelMerger({"model_merging_enabled": True, "merge_method": "sens_merging"})
        merger.register_model("coding", lambda q: "code response", "coding")
        merger.register_model("reasoning", lambda q: "reasoning response", "reasoning")
        callback = merger.merge_for_task("coding", "write code")
        assert callback is not None
        result = callback("write code")
        assert result is not None

    def test_merge_for_task_activation(self):
        merger = ModelMerger({"model_merging_enabled": True, "merge_method": "activation_informed"})
        merger.register_model("coding", lambda q: "code response", "coding")
        callback = merger.merge_for_task("coding", "write code")
        assert callback is not None
        result = callback("write code")
        assert result is not None

    def test_merge_for_task_dynamic(self):
        merger = ModelMerger({"model_merging_enabled": True, "merge_method": "dynamic"})
        merger.register_model("coding", lambda q: "code response", "coding")
        merger.register_model("reasoning", lambda q: "reasoning response", "reasoning")
        callback = merger.merge_for_task("coding", "write code")
        assert callback is not None
        result = callback("write code")
        assert result is not None

    def test_merge_for_task_disabled(self):
        merger = ModelMerger({"model_merging_enabled": False})
        merger.register_model("coding", lambda q: "code", "coding")
        callback = merger.merge_for_task("coding", "test")
        assert callback is None

    def test_merge_for_task_no_models(self):
        merger = ModelMerger({"model_merging_enabled": True})
        callback = merger.merge_for_task("unknown_type", "test")
        assert callback is None

    def test_unregister_model(self):
        merger = ModelMerger({"model_merging_enabled": True})
        merger.register_model("coding", lambda q: "code", "coding")
        merger.unregister_model("coding")
        assert "coding" not in merger.models

    def test_record_performance(self):
        db = sqlite3.connect(":memory:")
        opt = MergeOptimizer(db)
        merger = ModelMerger({"model_merging_enabled": True}, optimizer=opt)
        merger.register_model("coding", lambda q: "code", "coding")
        callback = merger.merge_for_task("coding", "test")
        result = callback("test")
        records = opt.get_merge_records("coding")
        assert len(records) >= 1
        db.close()

    def test_dynamic_selects_strategy(self):
        merger = ModelMerger({"model_merging_enabled": True, "merge_method": "dynamic"})
        merger.register_model("m1", lambda q: "r1", "coding")
        merger.register_model("m2", lambda q: "r2", "reasoning")
        callback = merger.merge_for_task("coding", "test")
        assert callback is not None
        result = callback("test")
        assert result is not None


# ── API Routes ───────────────────────────────────────────────────


class TestMergingRoutes:
    def test_get_strategies(self, client):
        res = client.get("/api/merging/strategies")
        assert res.status_code == 200
        data = res.json()
        assert "strategies" in data
        assert len(data["strategies"]) == 4

    def test_get_task_strategies(self, client):
        res = client.get("/api/merging/task-strategies")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 6

    def test_set_task_strategy(self, client):
        res = client.post("/api/merging/task-strategies", json={
            "task_type": "coding",
            "strategy": "sens_merging",
        })
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_set_invalid_task_type(self, client):
        res = client.post("/api/merging/task-strategies", json={
            "task_type": "invalid",
            "strategy": "sens_merging",
        })
        assert res.status_code == 400

    def test_set_invalid_strategy(self, client):
        res = client.post("/api/merging/task-strategies", json={
            "task_type": "coding",
            "strategy": "invalid_strategy",
        })
        assert res.status_code == 400

    def test_test_merge(self, client):
        res = client.post("/api/merging/test", json={
            "task_type": "coding",
            "query": "write a function",
        })
        assert res.status_code == 200
        data = res.json()
        assert "success" in data

    def test_get_performance(self, client):
        res = client.get("/api/merging/performance/coding")
        assert res.status_code == 200
        data = res.json()
        assert "scores" in data
        assert "records" in data

    def test_get_status(self, client):
        res = client.get("/api/merging/status")
        assert res.status_code == 200
        data = res.json()
        assert "enabled" in data
        assert "available_strategies" in data
