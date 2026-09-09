const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { sub: "6a6df896bc7e237db5beb03a", accountType: "user" }, 
  "rebar_super_secret_access_key_963870"
);

http.get('http://localhost:3000/api/bbs/test-update', {
  headers: { 'Authorization': `Bearer ${token}` }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
}).on('error', console.error);
