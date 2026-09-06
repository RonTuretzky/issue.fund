import express from "express";
import fs from "node:fs";
import {createPublicClient, http, isAddress} from "viem";
const client = createPublicClient({transport:http("http://127.0.0.1:8547")});
const deployment = () => JSON.parse(fs.readFileSync(".local/deployment.rsa.json", "utf8"));
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  if (!["localhost", "127.0.0.1", "::1"].includes(req.hostname)) return res.sendStatus(403);
  const origin = req.get("origin");
  if (origin && !["http://127.0.0.1:5174", "http://localhost:5174", "http://127.0.0.1:4319", "http://localhost:4319"].includes(origin)) return res.sendStatus(403);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});
app.get("/api/config", async (req,res) => {
  const d=deployment(); const [chain, block]=await Promise.all([client.getChainId(),client.getBlock()]);
  if(chain!==31337||d.chainId!==31337) throw new Error("Local chain only");
  res.json({...d,chainTime:Number(block.timestamp)});
});
const read=(name,args=[])=>{const d=deployment();return client.readContract({address:d.contract,abi:d.abi,functionName:name,args});};
app.get("/api/bounties", async (req,res)=>{
 const count=Number(await read("nextId"));
 const bounties=await Promise.all(Array.from({length:Math.min(count-1,100)},async(_,i)=>{
  const id=count-i-1,b=await read("getBounty",[BigInt(id)]),bountyRef=await read("referenceFor",[BigInt(id)]);
  return {...b,id,issue:Number(b.issue),pr:Number(b.pr),createdAt:Number(b.createdAt),deadline:Number(b.deadline),amount:String(b.amount),bountyRef,keyHash:deployment().keyHash};
 }));res.json(bounties);
});
app.get("/api/credits/:address", async (req,res)=>{
 if(!isAddress(req.params.address))return res.status(400).json({error:"Invalid address"});
 res.json({amount:String(await read("credits",[req.params.address]))});
});
app.post("/rpc", express.json({ limit: "1mb" }), async (req, res) => {
  const response = await fetch("http://127.0.0.1:8547", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body) });
  res.status(response.status).type("json").send(await response.text());
});
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));
app.use(express.static("dist"));
app.use((error, req, res, next) => res.status(500).json({ error: "The local development service is unavailable." }));
app.listen(4319, "127.0.0.1", () => console.log("Local development API: http://127.0.0.1:4319 (no prover)"));
