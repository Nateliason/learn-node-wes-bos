const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true, 
        required: "Please enter a store name"
    },
    slug: String, 
    description: {
        type: String,
        trim: true
    },
    tags: [String],
    created: {
        type: Date,
        default: Date.now
    },
    location: {
        type: {
            type: String,
            default: 'Point'
        },
        coordinates: [{
            type: Number,
            required: "You must supply coordinates"
        }],
        address: {
            type: String,
            required: "You must supply an address"
        }
    },
    photo: String,
    author: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: "You must supply an author"
    }
});

storeSchema.pre('save', async function(next) {
    if(!this.isModified('name')) {
        return next();
    }
    this.slug = slug(this.name);
    
    const slugRegEx = RegExp(`^(${this.slug})((-[0-9]*$)?)$`, `i`);

    //this.constructor is the same as Store, but we haven't made Store yet
    const storesWithSlug = await this.constructor.find({ slug: slugRegEx}); 

    if(storesWithSlug.length) {
        this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
    }

    next();
});

storeSchema.statics.getTagsList = function() {
    return this.aggregate([
        { $unwind: '$tags'},
        { $group: { _id: '$tags', count: { $sum: 1}}},
        { $sort: { count: -1}}
    ]);
}

module.exports = mongoose.model('Store', storeSchema);