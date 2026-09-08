#!/bin/bash
set -e

echo "🚀 NimTrust Setup"
echo "================="

# Check Node
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org or run:"
  echo "   brew install node"
  exit 1
fi

echo "✓ Node $(node --version)"
echo "✓ npm $(npm --version)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Create .env.local template
if [ ! -f ".env.local" ]; then
  echo ""
  echo "📝 Creating .env.local template..."
  cat > .env.local << 'EOF'
# Nimiq Network (testnet for development, switch to mainnet after testing)
NEXT_PUBLIC_NIMIQ_NETWORK=testnet
NIMIQ_RPC_ENDPOINT=https://testnet.nimiq.com  # Replace with actual testnet RPC
NIMIQ_MAINNET_RPC_ENDPOINT=https://nimiq.com   # Replace with actual mainnet RPC

# Auth / Session
JWT_SECRET=your-random-32-char-secret-key-here

# Database (get from Supabase)
DATABASE_URL=postgresql://user:password@db.supabase.co/postgres

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-...

# HTLC Timeout (blocks, ~4 blocks per minute on Nimiq, 14400 = ~10 days)
HTLC_TIMEOUT_BLOCKS=14400
EOF
  echo "⚠️  Update .env.local with real credentials:"
  echo "   - ANTHROPIC_API_KEY: get from console.anthropic.com"
  echo "   - DATABASE_URL: create Supabase project, copy PostgreSQL URL"
  echo "   - JWT_SECRET: generate a random 32-char string"
  echo "   - Nimiq RPC endpoints: check nimiq.dev/mini-apps"
fi

# Initialize Prisma
echo ""
echo "🗄️  Initializing database schema..."
npx prisma migrate dev --name init 2>/dev/null || echo "⚠️  Database init deferred (update .env.local first)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with real API keys and DB URL"
echo "2. npm run dev (starts Next.js on localhost:3000)"
echo "3. Day 1: Validate HTLC SDK method against real SDK/Nimiq skill"
echo ""
