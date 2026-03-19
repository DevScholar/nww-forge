window.api.on('pong', (_event, msg) => {
  document.getElementById('output').textContent = msg;
});

document.getElementById('btn').addEventListener('click', () => {
  window.api.send('ping', 'Hello from renderer!');
});
