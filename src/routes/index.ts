import type { FastifyInstance } from 'fastify';
import { BlockService } from '../services/blockService';
import type { Block } from '../interfaces';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  const blockService = new BlockService();

  // Health check
  fastify.get('/', async (request, reply) => {
    return { status: 'ok', message: 'Blockchain Indexer API' };
  });

  // POST /blocks
  fastify.post<{ Body: Block }>('/blocks', async (request, reply) => {
    try {
      const block = request.body;

      if (!block || !block.id || !block.height || !block.transactions) {
        return reply.status(400).send({
          error: 'Invalid block format'
        });
      }

      const validationError = await blockService.addBlock(block);

      if (validationError) {
        return reply.status(400).send(validationError);
      }

      return reply.status(200).send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  });

  // GET /balance/:address
  fastify.get<{ Params: { address: string } }>(
  '/balance/:address',
  async (request, reply) => {
    try {
      const { address } = request.params;

      if (!address) {
        return reply.status(400).send({
          error: 'Address parameter is required'
        });
      }

      const balance = await blockService.getBalance(address);

      return reply.status(200).send({
        address,
        balance: Number(balance)  // Convert to number
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal server error'
      });
    }
  }
);

  // POST /rollback
  fastify.post<{ Querystring: { height: string } }>(
    '/rollback',
    async (request, reply) => {
      try {
        const heightParam = request.query.height;

        if (!heightParam) {
          return reply.status(400).send({
            error: 'Height query parameter is required'
          });
        }

        const targetHeight = parseInt(heightParam);

        if (isNaN(targetHeight) || targetHeight < 0) {
          return reply.status(400).send({
            error: 'Invalid height parameter'
          });
        }

        const validationError = await blockService.rollback(targetHeight);

        if (validationError) {
          return reply.status(400).send(validationError);
        }

        return reply.status(200).send({
          success: true,
          height: targetHeight
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );
}