import express, { Request, Response } from 'express';
import knex from 'knex';
import knexfile from './knexfile.js';
import { createClient } from 'redis';
import arnavmq from 'arnavmq';

// Types and interfaces
interface Bringgster {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
}

interface CreateBringgsterRequest {
  first_name: string;
  last_name: string;
  role: string;
}

interface UpdateBringgsterRequest {
  first_name?: string;
  last_name?: string;
  role?: string;
}

interface ApiResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

// Initialize Express app
const app = express();
const port: number = 8080;

// Initialize Knex with development configuration
const db: knex.Knex = knex(knexfile.development);

// Initialize Redis client
const redisClient = createClient({ url: "redis://localhost:6379" });
redisClient.on("error", (err: Error) => console.error("Redis error:", err));

// Initialize arnavmq
const mq = arnavmq({ host: "amqp://localhost" });

// Connect to Redis
(async (): Promise<void> => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
  }
})();

// Connect to arnavmq
(async (): Promise<void> => {
  try {
    console.log("✅ Bringgster connected to RabbitMQ");
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error);
  }
})();

// Constants
const TTL: number = 60 * 60; // 1 hour
const ALL_KEY: string = "bringgsters:all";
const ID_KEY = (id: number): string => `bringgster:id:${id}`;

// Middleware
app.use(express.json());

// Routes
app.get("/bringgsters", async (req: Request, res: Response): Promise<void> => {
  try {
    const reply = await mq.publish("bringgsters", { type: "getAllBringgsters" }, { rpc: true, timeout: 5000 });
    const response: ApiResponse<unknown> = { message: "Reply received", data: reply };
    res.json(response);
  } catch (err: any) {
    const response: ApiResponse<never> = { message: "Error", error: err.message };
    res.status(500).json(response);
  }
});

app.get("/bringgsters/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id: string = req.params.id;
    const reply = await mq.publish("bringgsters", { type: "getBringgsterById", id: parseInt(id) }, { rpc: true, timeout: 5000 });
    const response: ApiResponse<unknown> = { message: `Reply received for id = ${id}`, data: reply };
    res.json(response);
  } catch (err: any) {
    const response: ApiResponse<never> = { message: "Error", error: err.message };
    res.status(500).json(response);
  }
});

app.post("/bringgsters", async (req: Request, res: Response): Promise<void> => {
  try {
    const data: CreateBringgsterRequest = req.body;
    console.log("Creating bringgster:", data);
    
    if (!data.first_name || !data.last_name || !data.role) {
      const response: ApiResponse<never> = { message: "Error", error: "Missing required fields" };
      res.status(400).json(response);
      return;
    }
    
    if (data.first_name.length >= 100 || data.last_name.length >= 100 || data.role.length >= 100) {
      const response: ApiResponse<never> = { message: "Error", error: "Field too long" };
      res.status(400).json(response);
      return;
    }
    
    const reply = await mq.publish("bringgsters", { type: "createBringgster", data }, { rpc: true, timeout: 5000 });
    const response: ApiResponse<unknown> = { message: "Reply received", data: reply };
    res.json(response);
  } catch (err: any) {
    const response: ApiResponse<never> = { message: "Error", error: err.message };
    res.status(500).json(response);
  }
});

app.put("/bringgsters/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id: string = req.params.id;
    const data: UpdateBringgsterRequest = req.body;
    const reply = await mq.publish("bringgsters", { type: "updateBringgster", id: parseInt(id), data }, { rpc: true, timeout: 5000 });
    const response: ApiResponse<unknown> = { message: "Reply received", data: reply };
    res.json(response);
  } catch (err: any) {
    const response: ApiResponse<never> = { message: "Error", error: err.message };
    res.status(500).json(response);
  }
});

app.delete("/bringgsters/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id: string = req.params.id;
    const reply = await mq.publish("bringgsters", { type: "deleteBringgster", id: parseInt(id) }, { rpc: true, timeout: 5000 });
    const response: ApiResponse<unknown> = { message: "Reply received", data: reply };
    res.json(response);
  } catch (err: any) {
    const response: ApiResponse<never> = { message: "Error", error: err.message };
    res.status(500).json(response);
  }
});

// Start the server
app.listen(port, (): void => {
  console.log(`Server running on port ${port}`);
});
