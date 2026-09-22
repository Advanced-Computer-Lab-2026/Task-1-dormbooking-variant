import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  roomNumber: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  purpose: { type: String }
});
const Model = mongoose.model('Test', schema);
async function run() {
  await mongoose.connect('mongodb://localhost:27017/test_scratch');
  await Model.deleteMany({});
  const doc = await Model.create({ roomNumber: '1', startDate: new Date(), endDate: new Date() });
  
  const fetched = await Model.findById(doc._id);
  Object.assign(fetched, { purpose: 'new' });
  try {
    await fetched.save();
    console.log('Success!');
  } catch(e) {
    console.error('Error:', e.message);
  }
  await mongoose.disconnect();
}
run();
