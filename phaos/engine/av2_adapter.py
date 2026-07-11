import logging
import sys
import os
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

# Ensure Alethea V1 parent directory is on the Python path
_ALETHEA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _ALETHEA_ROOT not in sys.path:
    sys.path.insert(0, _ALETHEA_ROOT)


class AV2Adapter:
    """Wraps existing AV2 components for PHAOS integration."""
    
    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self._initialized = False
        self._av2_orchestrator = None
        self._self_consistency = None
        self._code_execution = None
        self._truth_vault = None
        self._skill_library = None
        self._vision_module = None
        self._design_vault = None
        
        self._initialize_components()
    
    def _initialize_components(self):
        """Try to import and initialize AV2 components. Graceful fallback on failure."""
        import threading

        def _try_import(import_fn, name):
            result = [None]
            def _target():
                try:
                    result[0] = import_fn()
                except Exception:
                    pass
            t = threading.Thread(target=_target, daemon=True)
            t.start()
            t.join(timeout=2)
            if t.is_alive():
                logger.warning(f"{name} import timed out")
                return None
            return result[0]

        cls = _try_import(lambda: __import__("components.av2.orchestrator", fromlist=["AV2Orchestrator"]).AV2Orchestrator, "AV2Orchestrator")
        if cls:
            try:
                self._av2_orchestrator = cls()
                logger.info("AV2Orchestrator initialized")
            except Exception as e:
                logger.warning(f"AV2Orchestrator init failed: {e}")

        sc = _try_import(lambda: __import__("components.av2.self_consistency", fromlist=["SelfConsistency"]).SelfConsistency, "SelfConsistency")
        if sc:
            try:
                sc_cfg = self.config.get("self_consistency", {})
                self._self_consistency = sc(
                    num_paths=sc_cfg.get("num_paths", 5),
                    temperature=sc_cfg.get("temperature", 0.7),
                    consistency_threshold=sc_cfg.get("consistency_threshold", 0.6),
                )
            except Exception as e:
                logger.warning(f"SelfConsistency init failed: {e}")

        ce = _try_import(lambda: __import__("components.av2.code_execution", fromlist=["CodeExecutionFeedback"]).CodeExecutionFeedback, "CodeExecutionFeedback")
        if ce:
            try:
                ce_cfg = self.config.get("code_execution", {})
                self._code_execution = ce(
                    max_iterations=ce_cfg.get("max_iterations", 3),
                    timeout=ce_cfg.get("timeout", 5),
                    sandbox_dir=ce_cfg.get("sandbox_dir", "./sandbox"),
                )
            except Exception as e:
                logger.warning(f"CodeExecutionFeedback init failed: {e}")

        tv = _try_import(lambda: __import__("components.av2.truth_vault", fromlist=["TruthVault"]).TruthVault, "TruthVault")
        if tv:
            try:
                tv_cfg = self.config.get("truth_vault", {})
                self._truth_vault = tv(
                    db_path=tv_cfg.get("db_path", "./truth_vault.db"),
                    ttl_rules=tv_cfg.get("ttl_rules", {}),
                )
            except Exception as e:
                logger.warning(f"TruthVault init failed: {e}")

        aslib = _try_import(lambda: (__import__("components.av2.adaptive_skills", fromlist=["AdaptiveSkillLibrary"]).AdaptiveSkillLibrary,
                                      __import__("components.av2.skill_scoring", fromlist=["SkillScoring"]).SkillScoring), "AdaptiveSkillLibrary")
        if aslib:
            try:
                lib_cls, score_cls = aslib
                as_cfg = self.config.get("adaptive_skills", {})
                scoring_cfg = as_cfg.get("scoring", {})
                scoring = score_cls(
                    threshold=scoring_cfg.get("threshold", 60),
                    weights=scoring_cfg.get("weights"),
                )
                self._skill_library = lib_cls(
                    db_path=as_cfg.get("db_path", "./skill_library.db"),
                    scoring=scoring,
                )
            except Exception as e:
                logger.warning(f"AdaptiveSkillLibrary init failed: {e}")

        vm = _try_import(lambda: __import__("components.av2.vision_module", fromlist=["VisionModule"]).VisionModule, "VisionModule")
        if vm:
            try:
                v_cfg = self.config.get("vision", {})
                self._vision_module = vm(vision_model=v_cfg.get("model", "minimax-m3"))
            except Exception as e:
                logger.warning(f"VisionModule init failed: {e}")

        self._initialized = True
    
    @property
    def is_available(self) -> bool:
        return self._initialized and any([
            self._av2_orchestrator, self._self_consistency,
            self._code_execution, self._truth_vault,
        ])
    
    def amplify_response(self, query: str, base_response: str, model_callback: Callable, query_type: str = "factual") -> dict[str, Any]:
        """Run AV2 amplification pipeline on a response."""
        if not self.is_available:
            return {"response": base_response, "amplifications_applied": [], "av2_available": False}
        
        try:
            if self._av2_orchestrator:
                result = self._av2_orchestrator.process(query, model_callback, query_type)
                return {
                    "response": result.get("response", base_response),
                    "amplifications_applied": result.get("amplifications_applied", []),
                    "metadata": result.get("metadata", {}),
                    "av2_available": True,
                }
        except Exception as e:
            logger.error(f"AV2 amplification failed: {e}")
        
        applied = []
        response = base_response
        
        if self._self_consistency:
            try:
                response = self._self_consistency.amplify(query, model_callback)
                applied.append("self_consistency")
            except Exception as e:
                logger.warning(f"SelfConsistency failed: {e}")
        
        return {"response": response, "amplifications_applied": applied, "av2_available": True}
    
    def check_truth_vault(self, query: str) -> dict[str, Any] | None:
        """Check TruthVault cache for a query."""
        if not self._truth_vault:
            return None
        try:
            cached = self._truth_vault.retrieve_fact(query)
            if cached:
                answer, sources, fact_type = cached
                return {"answer": answer, "sources": sources, "fact_type": fact_type}
        except Exception as e:
            logger.warning(f"TruthVault lookup failed: {e}")
        return None
    
    def store_in_truth_vault(self, query: str, answer: str, sources: list[str] | None = None) -> bool:
        """Store a fact in TruthVault."""
        if not self._truth_vault:
            return False
        try:
            self._truth_vault.store_fact(query=query, answer=answer, sources=sources or [])
            return True
        except Exception as e:
            logger.warning(f"TruthVault store failed: {e}")
            return False
    
    def detect_code(self, text: str) -> bool:
        """Check if text contains code patterns."""
        code_keywords = {"function", "def ", "class ", "import ", "return", "if ", "for ", "while ", "try:", "except:", "async ", "await ", "print(", "console.log", "<html", "<div", "<script"}
        matches = sum(1 for kw in code_keywords if kw in text)
        return matches >= 2
    
    def detect_design(self, query: str) -> bool:
        """Check if query is design-related."""
        if self._vision_module:
            try:
                return self._vision_module.needs_vision(query)
            except Exception:
                pass
        design_keywords = {"screenshot", "design", "ui", "looks like", "colors", "layout", "visual", "logo", "mockup", "wireframe", "style", "theme", "palette"}
        return any(kw in query.lower() for kw in design_keywords)
    
    def apply_skills(self, query: str, top_k: int = 3) -> str:
        """Retrieve and apply relevant skills."""
        if not self._skill_library:
            return ""
        try:
            return self._skill_library.apply_skills(query, top_k=top_k)
        except Exception as e:
            logger.warning(f"Skill library failed: {e}")
            return ""
    
    def get_status(self) -> dict[str, Any]:
        return {
            "initialized": self._initialized,
            "av2_orchestrator": self._av2_orchestrator is not None,
            "self_consistency": self._self_consistency is not None,
            "code_execution": self._code_execution is not None,
            "truth_vault": self._truth_vault is not None,
            "skill_library": self._skill_library is not None,
            "vision_module": self._vision_module is not None,
        }
