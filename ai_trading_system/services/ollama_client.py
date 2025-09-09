"""
Ollama client for local LLM inference
"""

import asyncio
import json
import aiohttp
from typing import Dict, List, Any, Optional
from datetime import datetime
import time

from ai_trading_system.config.settings import LLMConfig
from ai_trading_system.utils.logging import get_logger
from ai_trading_system.utils.errors import AnalysisError, NetworkError


class OllamaClient:
    """Ollama client for local LLM inference"""
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self.logger = get_logger("ollama_client")
        self.base_url = config.ollama_base_url.rstrip('/')
        self.model = config.ollama_model
        
        # Session for connection pooling
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Request tracking
        self.request_count = 0
        self.last_request_time = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def _ensure_session(self):
        """Ensure aiohttp session is created"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=self.config.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def health_check(self) -> bool:
        """Check if Ollama server is available"""
        try:
            await self._ensure_session()
            
            async with self.session.get(f"{self.base_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    # Check if our model is available
                    models = [model.get('name', '') for model in data.get('models', [])]
                    model_available = any(self.model in model for model in models)
                    
                    if not model_available:
                        self.logger.warning("Configured model not found", {
                            "model": self.model,
                            "available_models": models
                        })
                        await self.close()  # Close session on failure
                        return False
                    
                    return True
                else:
                    await self.close()  # Close session on failure
                    return False
        except Exception as e:
            self.logger.error("Ollama health check failed", {"error": str(e)})
            await self.close()  # Close session on failure
            return False
    
    async def generate_completion(
        self, 
        prompt: str, 
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        system_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate completion using Ollama"""
        try:
            await self._ensure_session()
            
            # Prepare the request payload
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature or self.config.temperature,
                    "num_predict": max_tokens or self.config.max_tokens,
                }
            }
            
            # Add system prompt if provided
            if system_prompt:
                payload["system"] = system_prompt
            
            start_time = time.time()
            
            async with self.session.post(
                f"{self.base_url}/api/generate",
                json=payload
            ) as response:
                
                if response.status != 200:
                    error_text = await response.text()
                    raise NetworkError(
                        f"Ollama API error: {response.status}",
                        endpoint="ollama_generate",
                        details={"response": error_text}
                    )
                
                result = await response.json()
                processing_time = time.time() - start_time
                
                # Update statistics
                self.request_count += 1
                self.last_request_time = datetime.utcnow()
                
                self.logger.debug("Ollama completion generated", {
                    "model": self.model,
                    "processing_time": processing_time,
                    "prompt_length": len(prompt),
                    "response_length": len(result.get('response', ''))
                })
                
                return {
                    "response": result.get('response', ''),
                    "model": self.model,
                    "processing_time": processing_time,
                    "done": result.get('done', True),
                    "context": result.get('context', []),
                    "total_duration": result.get('total_duration', 0),
                    "load_duration": result.get('load_duration', 0),
                    "prompt_eval_count": result.get('prompt_eval_count', 0),
                    "eval_count": result.get('eval_count', 0)
                }
                
        except aiohttp.ClientError as e:
            raise NetworkError(
                "Ollama connection error",
                endpoint="ollama_generate",
                original_error=e
            )
        except Exception as e:
            raise AnalysisError(
                "Ollama completion failed",
                analyzer="ollama_client",
                original_error=e
            )
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> Dict[str, Any]:
        """Generate chat completion using Ollama (if supported by model)"""
        try:
            await self._ensure_session()
            
            # Prepare the request payload
            payload = {
                "model": self.model,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature or self.config.temperature,
                    "num_predict": max_tokens or self.config.max_tokens,
                }
            }
            
            start_time = time.time()
            
            async with self.session.post(
                f"{self.base_url}/api/chat",
                json=payload
            ) as response:
                
                if response.status != 200:
                    error_text = await response.text()
                    raise NetworkError(
                        f"Ollama chat API error: {response.status}",
                        endpoint="ollama_chat",
                        details={"response": error_text}
                    )
                
                result = await response.json()
                processing_time = time.time() - start_time
                
                # Update statistics
                self.request_count += 1
                self.last_request_time = datetime.utcnow()
                
                message = result.get('message', {})
                content = message.get('content', '')
                
                self.logger.debug("Ollama chat completion generated", {
                    "model": self.model,
                    "processing_time": processing_time,
                    "messages_count": len(messages),
                    "response_length": len(content)
                })
                
                return {
                    "response": content,
                    "model": self.model,
                    "processing_time": processing_time,
                    "done": result.get('done', True),
                    "total_duration": result.get('total_duration', 0),
                    "load_duration": result.get('load_duration', 0),
                    "prompt_eval_count": result.get('prompt_eval_count', 0),
                    "eval_count": result.get('eval_count', 0)
                }
                
        except aiohttp.ClientError as e:
            raise NetworkError(
                "Ollama connection error",
                endpoint="ollama_chat",
                original_error=e
            )
        except Exception as e:
            raise AnalysisError(
                "Ollama chat completion failed",
                analyzer="ollama_client",
                original_error=e
            )
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List available models in Ollama"""
        try:
            await self._ensure_session()
            
            async with self.session.get(f"{self.base_url}/api/tags") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('models', [])
                else:
                    error_text = await response.text()
                    raise NetworkError(
                        f"Failed to list Ollama models: {response.status}",
                        endpoint="ollama_tags",
                        details={"response": error_text}
                    )
                    
        except aiohttp.ClientError as e:
            raise NetworkError(
                "Ollama connection error",
                endpoint="ollama_tags",
                original_error=e
            )
        except Exception as e:
            raise AnalysisError(
                "Failed to list Ollama models",
                analyzer="ollama_client",
                original_error=e
            )
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get client usage statistics"""
        return {
            'request_count': self.request_count,
            'last_request_time': self.last_request_time.isoformat() if self.last_request_time else None,
            'model': self.model,
            'base_url': self.base_url
        }


class OllamaModelManager:
    """Manages Ollama model operations"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.logger = get_logger("ollama_model_manager")
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def _ensure_session(self):
        """Ensure aiohttp session is created"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=300)  # Longer timeout for model operations
            self.session = aiohttp.ClientSession(timeout=timeout)
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama registry"""
        try:
            await self._ensure_session()
            
            payload = {"name": model_name}
            
            self.logger.info("Pulling Ollama model", {"model": model_name})
            
            async with self.session.post(
                f"{self.base_url}/api/pull",
                json=payload
            ) as response:
                
                if response.status == 200:
                    # Stream the response to track progress
                    async for line in response.content:
                        if line:
                            try:
                                data = json.loads(line.decode())
                                if data.get('status'):
                                    self.logger.debug("Model pull progress", {
                                        "model": model_name,
                                        "status": data.get('status'),
                                        "completed": data.get('completed'),
                                        "total": data.get('total')
                                    })
                            except json.JSONDecodeError:
                                continue
                    
                    self.logger.info("Model pull completed", {"model": model_name})
                    return True
                else:
                    error_text = await response.text()
                    self.logger.error("Model pull failed", {
                        "model": model_name,
                        "status": response.status,
                        "error": error_text
                    })
                    return False
                    
        except Exception as e:
            self.logger.error("Model pull error", {
                "model": model_name,
                "error": str(e)
            })
            return False
    
    async def delete_model(self, model_name: str) -> bool:
        """Delete a model from Ollama"""
        try:
            await self._ensure_session()
            
            payload = {"name": model_name}
            
            async with self.session.delete(
                f"{self.base_url}/api/delete",
                json=payload
            ) as response:
                
                if response.status == 200:
                    self.logger.info("Model deleted", {"model": model_name})
                    return True
                else:
                    error_text = await response.text()
                    self.logger.error("Model deletion failed", {
                        "model": model_name,
                        "status": response.status,
                        "error": error_text
                    })
                    return False
                    
        except Exception as e:
            self.logger.error("Model deletion error", {
                "model": model_name,
                "error": str(e)
            })
            return False