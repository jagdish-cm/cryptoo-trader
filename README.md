# AI Trading System

A sophisticated automated cryptocurrency trading system that combines technical analysis, sentiment analysis via LLMs, and advanced risk management for 24/7 trading operations.

## Features

- **7-Phase Trading Algorithm**: From market regime analysis to trade execution and management
- **Multi-Source Analysis**: Technical indicators, sentiment analysis, and event detection
- **AI-Powered**: OpenAI GPT-4 or local Ollama integration for sentiment and event analysis
- **Risk Management**: Comprehensive portfolio and volatility risk controls
- **Real-Time Data**: WebSocket integration with 100+ exchanges via CCXT
- **Paper Trading**: Full support for Binance testnet and sandbox environments

## Quick Start

### Prerequisites

- Python 3.11+
- Redis server
- PostgreSQL database
- Binance testnet account
- **LLM Provider** (choose one):
  - OpenAI API key, OR
  - Ollama installed locally (free alternative)

### Installation

1. **Clone and install dependencies:**
```bash
pip install -e .
```

2. **Set up environment variables:**
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

3. **Start required services:**
```bash
# Start Redis (macOS with Homebrew)
brew services start redis

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql
```

4. **Initialize database:**
```bash
python -m ai_trading_system.scripts.init_db
```

5. **Run the system:**
```bash
python -m ai_trading_system.main
```

## Configuration

The system uses environment variables for configuration. See `.env.example` for all available options.

### Key Configuration Options

**Exchange Configuration:**
- `EXCHANGE_NAME=binance`
- `EXCHANGE_SANDBOX=true` (for paper trading)
- `EXCHANGE_API_KEY=your_binance_testnet_key`
- `EXCHANGE_API_SECRET=your_binance_testnet_secret`

**LLM Configuration:**
- `LLM_PROVIDER=auto` (auto-detects: OpenAI if API key set, otherwise Ollama)
- `LLM_API_KEY=your_openai_api_key` (leave empty to use Ollama)
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_MODEL=llama3.2`

## LLM Setup

The system supports two LLM providers for sentiment analysis and event detection:

### Option 1: OpenAI (Paid, High Quality)

1. **Get OpenAI API Key:**
   - Visit: https://platform.openai.com/api-keys
   - Create an API key with GPT-4 access

2. **Configure OpenAI:**
   ```bash
   LLM_PROVIDER=openai
   LLM_API_KEY=your_openai_api_key
   LLM_MODEL_NAME=gpt-4
   ```

### Option 2: Ollama (Free, Local)

1. **Install Ollama:**
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. **Start Ollama and Pull Model:**
   ```bash
   # Start Ollama server
   ollama serve
   
   # In another terminal, pull the model
   ollama pull llama3.2
   ```

3. **Configure Ollama:**
   ```bash
   LLM_PROVIDER=ollama
   LLM_API_KEY=  # Leave empty
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```

### Test LLM Setup

```bash
# Test both providers
python ai_trading_system/scripts/test_llm_providers.py
```

For detailed Ollama setup instructions, see [OLLAMA_SETUP.md](OLLAMA_SETUP.md).

## Paper Trading Setup

1. **Get Binance Testnet Credentials:**
   - Visit: https://testnet.binance.vision/
   - Create account and generate API keys
   - Enable spot trading permissions

2. **Configure for Paper Trading:**
   ```bash
   EXCHANGE_SANDBOX=true
   EXCHANGE_API_KEY=your_testnet_key
   EXCHANGE_API_SECRET=your_testnet_secret
   ```

3. **Test Configuration:**
   ```bash
   python -m ai_trading_system.scripts.test_connection
   ```

## Architecture

The system follows a modular, event-driven architecture:

- **Data Layer**: Real-time data ingestion and storage
- **Analysis Layer**: Technical analysis, sentiment analysis, regime detection
- **Decision Layer**: Signal fusion and risk management
- **Execution Layer**: Trade execution and position management

## Monitoring

- **Logs**: Structured JSON logging with correlation IDs
- **Metrics**: Performance tracking and system health monitoring
- **Alerts**: Configurable alerts for system events and trading signals

## Safety Features

- **Paper Trading**: Full sandbox support for risk-free testing
- **Risk Limits**: Configurable position sizing and exposure limits
- **Emergency Exits**: Automatic position closure on critical events
- **Circuit Breakers**: Automatic system protection on failures

## License

MIT License - see LICENSE file for details.