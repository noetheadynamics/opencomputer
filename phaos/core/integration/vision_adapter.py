"""Vision Model Integration — model-agnostic vision API with fallback."""

from __future__ import annotations

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class VisionAdapter:
    """Model-agnostic vision integration for any OpenAI-compatible API."""

    def __init__(self, config: Optional[Dict] = None):
        config = config or {}
        self.enabled = config.get("vision_enabled", False) or os.getenv(
            "VISION_ENABLED", ""
        ).lower() in ("true", "1", "yes")
        self.base_url = config.get("vision_base_url") or os.getenv(
            "VISION_BASE_URL"
        )
        self.api_key = config.get("vision_api_key") or os.getenv("VISION_API_KEY")
        self.model = config.get("vision_model") or os.getenv("VISION_MODEL")
        self.provider_label = config.get("vision_provider_label", "Vision Model")

    def is_configured(self) -> bool:
        """Check if vision is properly configured."""
        return bool(self.enabled and self.api_key and self.base_url and self.model)

    async def process_design_query(
        self,
        query: str,
        image_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Process a design/vision query."""
        if not self.is_configured():
            return {
                "success": False,
                "error": "No vision model configured. Please add a vision provider in Settings.",
                "fallback": True,
            }

        try:
            import httpx

            messages = []
            if image_url:
                messages.append(
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": query},
                            {
                                "type": "image_url",
                                "image_url": {"url": image_url},
                            },
                        ],
                    }
                )
            else:
                messages.append({"role": "user", "content": query})

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    json={
                        "model": self.model,
                        "messages": messages,
                        "max_tokens": 4096,
                    },
                    timeout=30.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "content": data["choices"][0]["message"]["content"],
                        "model": self.model,
                        "provider": self.provider_label,
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Vision API error: {response.status_code}",
                        "fallback": True,
                    }
        except ImportError:
            return {
                "success": False,
                "error": "httpx not installed",
                "fallback": True,
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Vision API error: {str(e)}",
                "fallback": True,
            }

    def get_status(self) -> Dict[str, Any]:
        """Get vision adapter status."""
        return {
            "enabled": self.enabled,
            "configured": self.is_configured(),
            "provider_label": self.provider_label,
            "model": self.model,
        }
