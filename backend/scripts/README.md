# Backend Scripts

Utility scripts for backend operations.

## RabbitMQ Queue Reset

### Problem

When RabbitMQ queues are created with certain parameters (like `x-max-priority`), they cannot be changed later. If a queue already exists with different parameters, you'll see this error:

```
PRECONDITION_FAILED - inequivalent arg 'x-max-priority' for queue 'digestion-jobs'
```

### Solution

Use the reset script to delete existing queues and allow NestJS to recreate them with correct parameters:

```bash
# From backend directory
npm run reset-rabbitmq

# Or run directly
bash scripts/reset-rabbitmq-queues.sh
```

### What It Does

The script deletes:
- Queue: `digestion-jobs`
- Queue: `digestion-failed`
- Exchange: `digestion-dlx`

After running the script, restart your NestJS application. The queues will be recreated automatically with the correct configuration:
- `digestion-jobs`: with `x-max-priority: 10` for priority-based job processing
- `digestion-failed`: dead-letter queue for failed jobs
- `digestion-dlx`: dead-letter exchange for retry routing

### Manual Alternative

If the script doesn't work, you can manually delete the queues via RabbitMQ Management UI:

1. Open: http://10.0.0.2:15672
2. Login: user `pensine`, password `pensine`
3. Go to "Queues" tab
4. Delete: `digestion-jobs`, `digestion-failed`
5. Go to "Exchanges" tab
6. Delete: `digestion-dlx`
7. Restart your application

### Configuration

The script uses environment variables (with defaults):
- `RABBITMQ_HOST`: Default `10.0.0.2`
- `RABBITMQ_PORT`: Default `15672` (management port)
- `RABBITMQ_USER`: Default `pensine`
- `RABBITMQ_PASS`: Default `pensine`
- `RABBITMQ_VHOST`: Default `/`

Override if needed:
```bash
RABBITMQ_HOST=localhost npm run reset-rabbitmq
```

### When to Use

Run this script when:
- First time setting up the queue with priority support
- Changing queue parameters (priority, TTL, etc.)
- Seeing PRECONDITION_FAILED errors
- Migrating from old queue configuration

### Safety

The script requires confirmation (y/N) before deleting queues. This prevents accidental data loss in production.

**⚠️ Warning:** Deleting queues will lose any pending messages. Only run this in development or when queues are empty.
