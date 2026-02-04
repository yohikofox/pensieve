#!/bin/bash
# Reset RabbitMQ Queues for Story 4.1
# Deletes existing queues and allows NestJS to recreate them with correct parameters

set -e

# RabbitMQ connection details
RABBITMQ_HOST="${RABBITMQ_HOST:-10.0.0.2}"
RABBITMQ_PORT="${RABBITMQ_PORT:-15672}"
RABBITMQ_USER="${RABBITMQ_USER:-pensine}"
RABBITMQ_PASS="${RABBITMQ_PASS:-pensine}"
RABBITMQ_VHOST="${RABBITMQ_VHOST:-/}"

echo "🐰 RabbitMQ Queue Reset Script"
echo "================================"
echo "Host: $RABBITMQ_HOST:$RABBITMQ_PORT"
echo "VHost: $RABBITMQ_VHOST"
echo ""

# Function to delete a queue
delete_queue() {
  local queue_name=$1
  echo "🗑️  Deleting queue: $queue_name"
  
  curl -i -u "$RABBITMQ_USER:$RABBITMQ_PASS" \
    -H "content-type:application/json" \
    -X DELETE \
    "http://$RABBITMQ_HOST:$RABBITMQ_PORT/api/queues/$RABBITMQ_VHOST/$queue_name" \
    2>/dev/null || echo "  (Queue may not exist)"
  
  echo ""
}

# Function to delete an exchange
delete_exchange() {
  local exchange_name=$1
  echo "🗑️  Deleting exchange: $exchange_name"
  
  curl -i -u "$RABBITMQ_USER:$RABBITMQ_PASS" \
    -H "content-type:application/json" \
    -X DELETE \
    "http://$RABBITMQ_HOST:$RABBITMQ_PORT/api/exchanges/$RABBITMQ_VHOST/$exchange_name" \
    2>/dev/null || echo "  (Exchange may not exist)"
  
  echo ""
}

echo "⚠️  This will delete the following RabbitMQ resources:"
echo "  - Queue: digestion-jobs"
echo "  - Queue: digestion-failed"
echo "  - Exchange: digestion-dlx"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "Starting cleanup..."
echo ""

# Delete queues (order matters: delete queues before exchanges)
delete_queue "digestion-jobs"
delete_queue "digestion-failed"

# Delete exchanges
delete_exchange "digestion-dlx"

echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Restart your NestJS application"
echo "2. The queues will be recreated with correct parameters (x-max-priority: 10)"
echo ""
