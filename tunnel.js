import localtunnel from 'localtunnel';

(async () => {
  try {
    const tunnel = await localtunnel({ port: 5000, subdomain: 'inventory-api-live' });
    console.log('TUNNEL_READY:', tunnel.url);
    tunnel.on('close', () => {
      console.log('Tunnel connection closed');
    });
    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to create tunnel:', err);
  }
})();

