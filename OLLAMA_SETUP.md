# Ollama Setup Guide

This guide will help you set up Ollama for local LLM inference with the AI Trading System.

## What is Ollama?

Ollama is a tool that allows you to run large language models locally on your machine. This is perfect for development and testing without needing to pay for API calls to OpenAI.

## Installation

### macOS

```bash
# Install Ollama using Homebrew
brew install ollama

# Or download from the official website
# Visit: https://ollama.ai/download
```

### Linux

```bash
# Install using the official script
curl -fsSL https://ollama.ai/install.sh | sh
```

### Windows

Download the installer from [https://ollama.ai/download](https://ollama.ai/download)

## Setup

### 1. Start Ollama Server

```bash
# Start the Ollama server (runs on port 11434 by default)
ollama serve
```

Keep this terminal open - the server needs to be running for the AI Trading System to work.

### 2. Pull a Model

In a new terminal, pull the recommended model:

```bash
# Pull the default model (llama3.2)
ollama pull llama3.2

# Or pull a larger, more capable model (requires more RAM)
ollama pull llama3.2:8b

# List available models
ollama list
```

### 3. Test the Installation

```bash
# Test that Ollama is working
ollama run llama3.2 "Hello, how are you?"
```

## Configuration

The AI Trading System is already configured to use Ollama when OpenAI API keys are not provided. The configuration is in your `.env` file:

```env
# LLM Configuration
LLM_PROVIDER=auto  # Will auto-detect: use OpenAI if API key is set, otherwise Ollama

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Testing

Run the LLM provider test to verify everything is working:

```bash
# Test all LLM providers
python ai_trading_system/scripts/test_llm_providers.py
```

## Model Recommendations

### For Development/Testing
- **llama3.2** (4GB RAM) - Fast, good for basic sentiment analysis
- **llama3.2:8b** (8GB RAM) - Better quality responses

### For Production
- **llama3.2:70b** (40GB+ RAM) - Highest quality, requires powerful hardware
- **codellama** - Good for code-related analysis

## Performance Tips

1. **RAM Requirements**: Ensure you have enough RAM for your chosen model
   - llama3.2: ~4GB RAM
   - llama3.2:8b: ~8GB RAM
   - llama3.2:70b: ~40GB RAM

2. **GPU Acceleration**: Ollama automatically uses GPU if available (NVIDIA/AMD)

3. **Model Management**: Remove unused models to save disk space
   ```bash
   ollama rm model_name
   ```

## Troubleshooting

### Ollama Server Not Starting
```bash
# Check if port 11434 is in use
lsof -i :11434

# Kill any existing Ollama processes
pkill ollama

# Restart Ollama
ollama serve
```

### Model Not Found
```bash
# List available models
ollama list

# Pull the required model
ollama pull llama3.2
```

### Connection Refused
- Make sure `ollama serve` is running
- Check that the URL in `.env` matches your Ollama server (default: http://localhost:11434)

### Slow Performance
- Use a smaller model (llama3.2 instead of llama3.2:8b)
- Ensure you have sufficient RAM
- Close other memory-intensive applications

## Switching Between OpenAI and Ollama

The system automatically detects which provider to use:

1. **Use OpenAI**: Set `LLM_API_KEY` in your `.env` file
2. **Use Ollama**: Leave `LLM_API_KEY` empty or unset
3. **Force a provider**: Set `LLM_PROVIDER=openai` or `LLM_PROVIDER=ollama`

## Benefits of Using Ollama

- ✅ **Free**: No API costs
- ✅ **Private**: Data stays on your machine
- ✅ **Fast**: No network latency
- ✅ **Offline**: Works without internet
- ✅ **Customizable**: Can fine-tune models for trading

## Next Steps

Once Ollama is set up and working:

1. Run the test script to verify functionality
2. Start the AI Trading System - it will automatically use Ollama
3. Monitor the logs to see LLM analysis in action
4. Consider upgrading to a larger model for better analysis quality

For more information, visit the [official Ollama documentation](https://github.com/ollama/ollama).