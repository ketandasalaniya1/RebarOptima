const mongoose = require('mongoose');

const uri = "mongodb+srv://ketandasalaniya1_db_user:d4dCGKiO3GFoCi06@cluster0.aghjxtj.mongodb.net/";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.useDb('test'); 
  
  const user = await mongoose.connection.db.collection('users').findOne({});
  console.log("User:", user._id);

  await mongoose.disconnect();
}

run().catch(console.error);
