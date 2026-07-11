import logging
import sys
import os
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Ensure Alethea V1 parent directory is on the Python path
_ALETHEA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if _ALETHEA_ROOT not in sys.path:
    sys.path.insert(0, _ALETHEA_ROOT)


class AletheaAdapter:
    """Wraps Alethea V2 components (classifier, gate, reasoning, validator) for PHAOS.
    
    Supports both local component loading and optional HTTP retrieval/KG endpoints.
    """
    
    def __init__(self, config: dict[str, Any] | None = None):
        self.config = config or {}
        self._classifier = None
        self._gate = None
        self._reasoning_engine = None
        self._validator = None
        self._initialized = False
        
        # Optional HTTP retrieval/KG endpoints
        self.retrieval_url = config.get("retrieval_url") or os.getenv("ALETHEA_RETRIEVAL_URL") if config else os.getenv("ALETHEA_RETRIEVAL_URL")
        self.retrieval_api_key = config.get("retrieval_api_key") or os.getenv("ALETHEA_RETRIEVAL_API_KEY") if config else os.getenv("ALETHEA_RETRIEVAL_API_KEY")
        self.kg_url = config.get("kg_url") or os.getenv("ALETHEA_KG_URL") if config else os.getenv("ALETHEA_KG_URL")
        self.kg_api_key = config.get("kg_api_key") or os.getenv("ALETHEA_KG_API_KEY") if config else os.getenv("ALETHEA_KG_API_KEY")
        
        self._initialize_components()
    
    def _initialize_components(self):
        """Try to import and initialize Alethea V2 components. Graceful fallback."""
        import threading

        def _try_import(import_fn, name):
            result_container = [None]
            error_container = [None]
            event = threading.Event()

            def _target():
                try:
                    result_container[0] = import_fn()
                except Exception as e:
                    error_container[0] = e
                finally:
                    event.set()

            t = threading.Thread(target=_target, daemon=True)
            t.start()
            if event.wait(timeout=2):
                if error_container[0] is not None:
                    return None
                return result_container[0]
            logger.warning(f"{name} import timed out")
            return None

        cls = _try_import(lambda: __import__("components.classifier", fromlist=["CategoryClassifier"]).CategoryClassifier, "CategoryClassifier")
        if cls:
            try:
                self._classifier = cls()
                logger.info("CategoryClassifier initialized")
            except Exception as e:
                logger.warning(f"CategoryClassifier init failed: {e}")

        val = _try_import(lambda: __import__("components.validator", fromlist=["OutputValidator"]).OutputValidator, "OutputValidator")
        if val:
            try:
                self._validator = val()
                logger.info("OutputValidator initialized")
            except Exception as e:
                logger.warning(f"OutputValidator init failed: {e}")

        eng = _try_import(lambda: __import__("components.reasoning", fromlist=["ReasoningEngine"]).ReasoningEngine, "ReasoningEngine")
        if eng:
            try:
                self._reasoning_engine = eng()
                logger.info("ReasoningEngine initialized")
            except Exception as e:
                logger.warning(f"ReasoningEngine init failed: {e}")

        gate = _try_import(lambda: __import__("components.gate", fromlist=["HardRetrievalGate"]).HardRetrievalGate, "HardRetrievalGate")
        if gate:
            try:
                self._gate = gate()
                logger.info("HardRetrievalGate initialized")
            except Exception as e:
                logger.warning(f"HardRetrievalGate init failed: {e}")

        self._initialized = True
    
    @property
    def is_available(self) -> bool:
        return self._initialized and any([self._classifier, self._reasoning_engine])
    
    def classify(self, query: str) -> int:
        """Classify query into Cat 1/2/3. Falls back to Cat 3."""
        if not self._classifier:
            logger.warning("Classifier unavailable, defaulting to Cat 3")
            return 3
        try:
            return self._classifier.predict(query)
        except Exception as e:
            logger.error(f"Classification failed: {e}, defaulting to Cat 3")
            return 3
    
    def run_gate(self, query: str, category: int) -> dict[str, Any]:
        """Run the Hard Retrieval Gate. Returns gate result dict."""
        if category in [1, 2]:
            return {"category": category, "context": None, "abstained": False, "abstention_message": ""}
        
        if not self._gate:
            return {"category": category, "context": None, "abstained": True, "abstention_message": "Gate not available"}
        
        try:
            result = self._gate.process(query)
            return {"category": result.category, "context": result.context, "abstained": result.abstained, "abstention_message": result.abstention_message}
        except Exception as e:
            logger.error(f"Gate failed: {e}")
            return {"category": category, "context": None, "abstained": True, "abstention_message": f"Gate error: {e}"}
    
    def reason(self, query: str, context: str | None = None) -> dict[str, Any]:
        """Run reasoning engine. Returns reasoning result dict."""
        if not self._reasoning_engine:
            return {"response": "Reasoning engine not available", "abstained": True, "provider": "unavailable"}
        
        try:
            result = self._reasoning_engine.answer(query, context=context or "")
            return {"response": result.response, "abstained": result.abstained, "provider": result.provider}
        except Exception as e:
            logger.error(f"Reasoning failed: {e}")
            return {"response": f"Reasoning error: {e}", "abstained": True, "provider": "error"}
    
    def validate(self, response: str, query: str, kg: Any = None, context: str | None = None) -> dict[str, Any]:
        """Validate response against KG. Returns validation result dict."""
        if not self._validator:
            return {"is_valid": True, "validated_response": response, "stripped_claims": [], "grounding_score": 1.0}
        
        try:
            if kg:
                result = self._validator.validate(response, kg, query, context)
            else:
                result = self._validator.validate_no_kg(response, query)
            return {"is_valid": result.is_valid, "validated_response": result.validated_response, "stripped_claims": result.stripped_claims, "grounding_score": result.grounding_score}
        except Exception as e:
            logger.error(f"Validation failed: {e}")
            return {"is_valid": True, "validated_response": response, "stripped_claims": [], "grounding_score": 0.5}
    
    def set_gate(self, gate: Any) -> None:
        """Manually set the gate (for dependency injection)."""
        self._gate = gate
        logger.info("Gate set manually")
    
    async def process_factual(self, query: str) -> tuple[str, list[str]]:
        """Process a factual query with optional HTTP retrieval + KG.
        
        Returns (context, sources) tuple. Returns ("", []) if retrieval is not configured.
        """
        if not self.retrieval_url:
            return "", []
        
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                retrieval_response = await client.post(
                    f"{self.retrieval_url}/search",
                    headers={"Authorization": f"Bearer {self.retrieval_api_key}"},
                    json={"query": query},
                    timeout=10.0,
                )
                if retrieval_response.status_code != 200:
                    return "", []
                
                results = retrieval_response.json().get("results", [])
                if not results:
                    return "", []
                
                sources = [r.get("source", "") for r in results if r.get("source")]
                context = "\n\n".join(r.get("text", "") for r in results)
                return context, sources
        except Exception as e:
            logger.warning(f"Retrieval failed: {e}")
            return "", []
    
    def get_status(self) -> dict[str, Any]:
        return {
            "initialized": self._initialized,
            "classifier": self._classifier is not None,
            "gate": self._gate is not None,
            "reasoning_engine": self._reasoning_engine is not None,
            "validator": self._validator is not None,
            "retrieval_configured": bool(self.retrieval_url),
            "kg_configured": bool(self.kg_url),
        }
