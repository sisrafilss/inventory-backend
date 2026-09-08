import { startTunnel } from "untun";

(async () => {
  try {
    console.log("Starting Cloudflare tunnel for port 5000...");
    const tunnel = await startTunnel({ port: 5000 });
    if (!tunnel) {
      console.error("Could not start tunnel");
      process.exit(1);
    }
    const url = await tunnel.getURL();
    console.log("CLOUDFLARE_TUNNEL_URL:", url);
  } catch (err) {
    console.error("Cloudflare tunnel failed:", err);
  }
})();

