// Runtime config so one build works locally and in production.
window.env = {
  NG_APP_API_URL: location.hostname.endsWith('letscrackadre.com')
    ? 'https://api.letscrackadre.com/api'
    : 'http://localhost:4000/api'
};
