const mongoose = require('mongoose');

const uri = "mongodb+srv://ketandasalaniya1_db_user:d4dCGKiO3GFoCi06@cluster0.aghjxtj.mongodb.net/";

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.useDb('test'); 
  
  const blocks = await mongoose.connection.db.collection('blockwings').find({}).toArray();
  if (blocks.length > 0) {
    console.log("Type of _id:", typeof blocks[0]._id, blocks[0]._id.constructor.name);
    console.log("Type of project_id:", typeof blocks[0].project_id, blocks[0].project_id.constructor.name);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
