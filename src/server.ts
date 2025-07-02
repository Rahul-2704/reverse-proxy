import cluster, { Worker } from "node:cluster";
import { rootConfigSchema, type ConfigSchemaType } from "./config-schema";

import http from "node:http";
import {
  WorkerMessageReplyType,
  WorkerMessageType,
  workerMessageReplySchema,
  workerMessageSchema,
} from "./server-schema";

interface CreateServerConfig {
  port: number;
  workerCount: number;
  config: ConfigSchemaType;
}

export default async function createServer(config: CreateServerConfig) {
  const { workerCount, port } = config;

  const WORKER_POOL: Worker[] = [];
  //   master node --> bind to port and run the worker nodes
  if (cluster.isPrimary) {
    // running worker nodes
    for (let i = 0; i < workerCount; i++) {
      const worker = cluster.fork({ config: JSON.stringify(config.config) });
      WORKER_POOL.push(worker);
      console.log(`Master Process:Worker node Spinned Up ${i}`);
    }

    // bind to the port

    const server = http.createServer(function (req, res) {
      // give request to the worker node
      const index = Math.floor(Math.random() * WORKER_POOL.length);
      console.log("index::", index);
      const worker: Worker = WORKER_POOL[index];

      if (!worker) {
        throw new Error("Worker not found");
      }

      const payload: WorkerMessageType = {
        requestType: "HTTP",
        headers: req.headers,
        body: null,
        url: `${req.url}`,
      };

      worker.send(JSON.stringify(payload));

      worker.on("message", async (workerReply: string) => {
        const reply = await workerMessageReplySchema.parseAsync(
          JSON.parse(workerReply)
        );
        if (reply.errorCode) {
          res.writeHead(parseInt(reply.errorCode));
          res.end(reply.error);
          return;
        } else {
          res.writeHead(200);
          res.end(reply.data);
          return;
        }
      });
    });

    server.listen(config.port, function () {
      console.log(`Server running on ${config.port}`);
    });
  } else {
    console.log("worker node");
    const config = await rootConfigSchema.parseAsync(
      JSON.parse(process.env.config as string)
    );

    process.on("message", async (message: string) => {
      const messageValidated = await workerMessageSchema.parseAsync(
        JSON.parse(message)
      );
      // implement logic
      const requestURL = messageValidated.url;
      const rule = config.server.rules.find((e) => e.path == requestURL);

      if (!rule) {
        const reply: WorkerMessageReplyType = {
          errorCode: "404",
          error: "Rule not Found",
        };

        if (process.send) return process.send(JSON.stringify(reply));
      }

      const upstreamId = rule?.upstreams[0];
      const upStream = config.server.upstreams.find((e) => e.id === upstreamId);

      if (!upstreamId) {
        const reply: WorkerMessageReplyType = {
          errorCode: "500",
          error: "Upstram not Found",
        };

        if (process.send) return process.send(JSON.stringify(reply));
      }

      const request = http.request(
        { host: upStream?.url, path: requestURL, method: "GET" },
        (proxyRes) => {
          let body = "";

          proxyRes.on("data", (chunk) => {
            body += chunk;
          });

          proxyRes.on("end", () => {
            const reply: WorkerMessageReplyType = {
              data: body,
            };
            if (process.send) return process.send(JSON.stringify(reply));
          });
        }
      );
      request.end();
    });
  }
}
