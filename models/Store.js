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
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true}
});

// Define our indexes 

storeSchema.index({
    name: 'text',
    description: 'text'
})

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
};

storeSchema.statics.getTopStores = function() {
    return this.aggregate([
        // Lookup stores and populate their reviews
        { $lookup: {from: 'reviews', localField: '_id', foreignField: 'store', as: 'reviews' }},
        // Filter for items that have 2 or more reviews
        { $match: {'reviews.1': {$exists: true}}},
        // Add the average review field, you can use $addField in other projects so you don't have to add all the fields back in
        { $project: {
            photo: '$$ROOT.photo',
            name: '$$ROOT.name',
            reviews: '$$ROOT.reviews',
            slug: '$$ROOT.slug',
            averageRating: { $avg: '$reviews.rating'}
        }},
        // sort it by our new field, highest reviews first
        { $sort: { averageRating: -1}},
        // Limit it to 10
        { $limit: 10 }
    ]);
};

// find reviews where the stores._id property === reviews store property
storeSchema.virtual('reviews', {
    ref: 'Review', // what model to link?
    localField: '_id', // which field on the store? 
    foreignField: 'store' // which field on the review?
});

function autopopulate(next) {
    this.populate('reviews');
    next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

module.exports = mongoose.model('Store', storeSchema);