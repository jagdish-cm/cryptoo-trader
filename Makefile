# AI Trading System - Development Makefile

.PHONY: help install setup test run clean dev-setup check-deps

# Default target
help:
	@echo "🚀 AI Trading System - Development Commands"
	@echo ""
	@echo "Setup Commands:"
	@echo "  make install     - Install Python dependencies"
	@echo "  make setup       - Complete system setup (install + services + db)"
	@echo "  make dev-setup   - Development setup with additional tools"
	@echo ""
	@echo "Database Commands:"
	@echo "  make init-db     - Initialize database tables"
	@echo "  make reset-db    - Reset database (WARNING: destroys data)"
	@echo ""
	@echo "Testing Commands:"
	@echo "  make test        - Run all tests"
	@echo "  make test-conn   - Test all connections"
	@echo "  make test-unit   - Run unit tests only"
	@echo ""
	@echo "Running Commands:"
	@echo "  make run         - Start the trading system"
	@echo "  make run-debug   - Start with debug logging"
	@echo ""
	@echo "Service Commands:"
	@echo "  make start-services - Start PostgreSQL and Redis"
	@echo "  make stop-services  - Stop PostgreSQL and Redis"
	@echo "  make check-services - Check service status"
	@echo ""
	@echo "Utility Commands:"
	@echo "  make clean       - Clean up temporary files"
	@echo "  make check-deps  - Check system dependencies"
	@echo "  make logs        - Show recent system logs"

# Installation
install:
	@echo "📦 Installing Python dependencies..."
	pip install -e .
	@echo "✅ Dependencies installed"

# Complete setup
setup: check-deps install start-services init-db
	@echo "🎉 Setup complete! Run 'make test-conn' to verify everything works."

# Development setup
dev-setup: setup
	@echo "🔧 Installing development tools..."
	pip install pytest pytest-asyncio pytest-mock black flake8 mypy
	@echo "✅ Development setup complete"

# Check system dependencies
check-deps:
	@echo "🔍 Checking system dependencies..."
	@command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 is required but not installed."; exit 1; }
	@command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL is required but not installed. Run: brew install postgresql"; exit 1; }
	@command -v redis-cli >/dev/null 2>&1 || { echo "❌ Redis is required but not installed. Run: brew install redis"; exit 1; }
	@echo "✅ All system dependencies found"

# Service management
start-services:
	@echo "🚀 Starting services..."
	@brew services start postgresql || echo "⚠️  PostgreSQL may already be running"
	@brew services start redis || echo "⚠️  Redis may already be running"
	@sleep 2
	@echo "✅ Services started"

stop-services:
	@echo "🛑 Stopping services..."
	@brew services stop postgresql
	@brew services stop redis
	@echo "✅ Services stopped"

check-services:
	@echo "📊 Service Status:"
	@brew services list | grep -E "(postgresql|redis)" || echo "No services found"

# Database management
init-db:
	@echo "🗄️  Initializing database..."
	python -m ai_trading_system.scripts.init_db
	@echo "✅ Database initialized"

reset-db:
	@echo "⚠️  WARNING: This will destroy all data!"
	@read -p "Are you sure? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@dropdb ai_trading_system 2>/dev/null || true
	@createdb ai_trading_system
	@make init-db
	@echo "✅ Database reset complete"

# Testing
test: test-unit test-conn
	@echo "✅ All tests completed"

test-conn:
	@echo "🧪 Testing connections..."
	python -m ai_trading_system.scripts.test_connection

test-unit:
	@echo "🧪 Running unit tests..."
	pytest tests/ -v

# Running the system
run:
	@echo "🚀 Starting AI Trading System..."
	python -m ai_trading_system.main

run-debug:
	@echo "🐛 Starting AI Trading System in debug mode..."
	TRADING_LOG_LEVEL=DEBUG python -m ai_trading_system.main

# Utility commands
clean:
	@echo "🧹 Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Cleanup complete"

logs:
	@echo "📋 Recent system logs (if running)..."
	@tail -f /tmp/ai_trading_system.log 2>/dev/null || echo "No log file found. System may not be running."

# Environment setup
env-example:
	@if [ ! -f .env ]; then \
		echo "📝 Creating .env from example..."; \
		cp .env.example .env; \
		echo "✅ .env file created. Please edit it with your API keys."; \
	else \
		echo "⚠️  .env file already exists"; \
	fi

# Quick start for new users
quickstart: env-example setup test-conn
	@echo ""
	@echo "🎉 Quick start complete!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit .env file with your API keys"
	@echo "2. Run: make test-conn"
	@echo "3. Run: make run"
	@echo ""

# Development workflow
dev: dev-setup
	@echo ""
	@echo "🔧 Development environment ready!"
	@echo ""
	@echo "Useful commands:"
	@echo "  make run-debug  - Run with debug logging"
	@echo "  make test       - Run all tests"
	@echo "  make clean      - Clean up files"
	@echo ""