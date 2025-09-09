# AI Trading System - Local Setup Guide

This guide will help you set up and run the AI Trading System locally for paper trading with Binance testnet.

## 📋 Prerequisites

### Required Software
- **Python 3.11+** - [Download here](https://www.python.org/downloads/)
- **PostgreSQL** - [Download here](https://www.postgresql.org/download/) or `brew install postgresql`
- **Redis** - [Download here](https://redis.io/download) or `brew install redis`
- **Git** - For cloning the repository

### Required API Keys
1. **Binance Testnet Account** - [Create here](https://testnet.binance.vision/)
2. **OpenAI API Key** - [Get here](https://platform.openai.com/api-keys)

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
# Install Python dependencies
pip install -e .

# Or if you prefer using a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -e .
```

### Step 2: Start Required Services

```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Start Redis (macOS with Homebrew)
brew services start redis

# Verify services are running
brew services list | grep -E "(postgresql|redis)"
```

### Step 3: Set Up Binance Testnet

1. **Create Testnet Account:**
   - Go to https://testnet.binance.vision/
   - Sign up for a new account
   - Verify your email

2. **Generate API Keys:**
   - Login to testnet
   - Go to API Management
   - Create new API key
   - **Important:** Enable "Spot & Margin Trading" permissions
   - Save your API Key and Secret Key securely

3. **Get Test Funds:**
   - In testnet dashboard, you'll have test USDT automatically
   - You can request more test funds if needed

### Step 4: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your API keys
nano .env  # or use your preferred editor
```

**Required Configuration in .env:**
```bash
# Binance Testnet Configuration
EXCHANGE_NAME=binance
EXCHANGE_SANDBOX=true
EXCHANGE_API_KEY=your_binance_testnet_api_key_here
EXCHANGE_API_SECRET=your_binance_testnet_secret_here

# OpenAI Configuration
LLM_API_KEY=your_openai_api_key_here

# Database Configuration (adjust if needed)
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=ai_trading_system
```

### Step 5: Initialize Database

```bash
# Initialize the database with required tables
python -m ai_trading_system.scripts.init_db
```

### Step 6: Test Connections

```bash
# Test all connections before running the system
python -m ai_trading_system.scripts.test_connection
```

You should see:
```
✅ All connections successful! System is ready to run.
```

### Step 7: Run the System

```bash
# Start the AI trading system
python -m ai_trading_system.main
```

## 🔧 Configuration Options

### Trading Configuration
Edit these values in your `.env` file:

```bash
# Risk Management
TRADING_MAX_POSITION_RISK=0.01          # 1% max risk per trade
TRADING_MAX_PORTFOLIO_EXPOSURE=0.20     # 20% max per asset
TRADING_VOLATILITY_THRESHOLD=0.05       # 5% volatility threshold

# Trading Parameters
TRADING_WATCHLIST=BTC/USDT,ETH/USDT,ADA/USDT,DOT/USDT,LINK/USDT
TRADING_TIMEFRAME=4h                    # Analysis timeframe
TRADING_MIN_SIGNAL_CONFIDENCE=0.7       # Minimum signal confidence
TRADING_MAX_OPEN_POSITIONS=5            # Max concurrent positions

# Paper Trading
PAPER_TRADING_ENABLED=true
PAPER_TRADING_INITIAL_BALANCE=10000     # Starting balance in USDT
```

### System Configuration
```bash
# Logging
TRADING_LOG_LEVEL=INFO                  # DEBUG, INFO, WARNING, ERROR
TRADING_LOG_FORMAT=json                 # json or text

# Performance
TRADING_MAX_WORKERS=4                   # Concurrent workers
TRADING_HEALTH_CHECK_INTERVAL=30        # Health check interval (seconds)
```

## 📊 Understanding the Output

When running, you'll see logs like:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "message": "Trading signal generated",
  "symbol": "BTC/USDT",
  "direction": "long",
  "confidence": 0.85,
  "setup_type": "long_support",
  "entry_price": 42500.0
}
```

### Key Log Messages:
- **"Current market regime"** - Shows Bull/Bear/Range mode
- **"Trading signal generated"** - New trading opportunity detected
- **"Signal filtered by strategy mode"** - Signal blocked by regime rules
- **"Health check passed"** - System is operating normally

## 🛠️ Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql

# Start PostgreSQL if not running
brew services start postgresql

# Create database if it doesn't exist
createdb ai_trading_system
```

#### 2. Redis Connection Failed
```bash
# Check if Redis is running
brew services list | grep redis

# Start Redis if not running
brew services start redis

# Test Redis connection
redis-cli ping
```

#### 3. Exchange API Errors
- **Invalid API Key**: Double-check your Binance testnet API key
- **Insufficient Permissions**: Ensure "Spot & Margin Trading" is enabled
- **Rate Limiting**: The system handles this automatically, but check your API limits

#### 4. OpenAI API Errors
- **Invalid API Key**: Verify your OpenAI API key is correct
- **Insufficient Credits**: Check your OpenAI account has available credits
- **Rate Limiting**: The system handles this with built-in rate limiting

#### 5. Python Import Errors
```bash
# Reinstall dependencies
pip install -e . --force-reinstall

# Check Python version
python --version  # Should be 3.11+
```

### Debug Mode
Run with debug logging for more detailed output:
```bash
# Set debug level in .env
TRADING_LOG_LEVEL=DEBUG

# Or run with debug temporarily
TRADING_LOG_LEVEL=DEBUG python -m ai_trading_system.main
```

### Testing Individual Components
```bash
# Test only database
python -c "
import asyncio
from ai_trading_system.scripts.test_connection import test_database_connection
asyncio.run(test_database_connection())
"

# Test only exchange
python -c "
import asyncio
from ai_trading_system.scripts.test_connection import test_exchange_connection
asyncio.run(test_exchange_connection())
"
```

## 📈 Paper Trading Features

The system runs in paper trading mode by default with these features:

- **Virtual Portfolio**: Starts with $10,000 USDT (configurable)
- **Real Market Data**: Uses live Binance testnet data
- **Full Algorithm**: Complete 7-phase trading algorithm
- **Risk Management**: All safety features enabled
- **Performance Tracking**: Real-time P&L and metrics
- **No Real Money**: All trades are simulated

## 🔄 System Architecture

The system follows this flow:
1. **Data Ingestion**: Continuous market data collection
2. **Regime Analysis**: Bitcoin-based market regime detection
3. **Technical Analysis**: Setup detection and indicator calculation
4. **Sentiment Analysis**: AI-powered news and social sentiment
5. **Signal Fusion**: Combines all analysis for high-confidence signals
6. **Risk Management**: Validates signals against risk parameters
7. **Trade Execution**: Simulated trade execution and management

## 📝 Next Steps

Once the system is running successfully:

1. **Monitor Performance**: Watch the logs for trading signals and regime changes
2. **Adjust Parameters**: Modify risk settings in `.env` as needed
3. **Add More Symbols**: Expand the watchlist for more opportunities
4. **Analyze Results**: Review trade logs and performance metrics
5. **Optimize Strategy**: Fine-tune parameters based on results

## 🆘 Getting Help

If you encounter issues:

1. **Check Logs**: Look for error messages in the console output
2. **Run Tests**: Use `python -m ai_trading_system.scripts.test_connection`
3. **Verify Config**: Double-check your `.env` file settings
4. **Check Services**: Ensure PostgreSQL and Redis are running
5. **Review Setup**: Go through this guide step by step

## 🔒 Security Notes

- **Never use real API keys** in development
- **Keep your .env file secure** and never commit it to version control
- **Use testnet only** for initial testing
- **Monitor your OpenAI usage** to avoid unexpected charges
- **Start with small position sizes** when moving to live trading

Happy trading! 🚀