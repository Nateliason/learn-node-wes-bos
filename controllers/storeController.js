const mongoose = require('mongoose');
const Store = mongoose.model('Store');
const User = mongoose.model('User');
const multer = require('multer');
const jimp = require('jimp');
const uuid = require('uuid');

const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if(isPhoto) {
            next(null, true)
        } else {
            next({ message: "That file type isn't allowed!"}, false);
        }
    }
}

exports.homePage = (req, res) => {
    res.render('index');
}

exports.addStore = (req, res) => {
    res.render('editStore', { title: 'Add Store' });
}

exports.upload = multer(multerOptions).single('photo');

exports.resize = async (req, res, next) => {
    // Check if there is no new file to resize
    if(!req.file) {
        next();
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`)
    next();
}

exports.createStore = async (req, res) => {
    req.body.author = req.user._id;
    const store = await (new Store(req.body)).save();
    req.flash('success', `Successfully saved ${store.name}.`);
    res.redirect(`/store/${store.slug}`);
}

exports.getStores = async (req, res) => { 
    const stores = await Store.find().populate('reviews');
    res.render('stores', {title: 'Stores', stores});
}

const confirmOwner = (store, user) => {
    if(!store.author.equals(user._id)) {
        throw Error('You must own a store to edit it');
    }
}

exports.editStore = async (req, res) => {
    // 1. Find the store given the ID 
    const store = await Store.findOne({ _id: req.params.id});
    // 2. Confirm they are the owner of the store
    confirmOwner(store, req.user);
    // 3. Render out the edit form so the user can update their store
    res.render('editStore', { title: `Edit ${store.name}`, store,});
}

exports.updateStore = async (req, res) => {
    req.body.location.type = "Point";
    const store = await Store.findOneAndUpdate({ _id: req.params.id}, req.body, {
        new: true, // Return the new store instead of the old one
        runValidators: true, // This checks the "required" variables again, like making sure there's a name
    }).exec();
    req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store</a>`);
    res.redirect(`/stores/${store._id}/edit`);
}

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({ slug: req.params.slug }).populate('author reviews');
    if(!store) return next();
    res.render('store', {title: store.name, store});
}

exports.getStoresByTag = async (req, res) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true};
    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery});
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
    res.render( 'tags', {tags, title: "Tags", tag, stores})
}

exports.searchStores = async (req, res) => {
    const stores = await Store
    // First find stores that match
    .find({
        $text: {
            $search: req.query.q
        }
    },{
        score: { $meta: 'textScore' }
    })
    // Then sort them by their text score, which is built in to MongoDB
    .sort({
        score: { $meta: 'textScore'}
    })
    // Limit to only 5 results
    .limit(5);
    res.json(stores);
}

exports.heartStore = async (req, res) => {
    const hearts = req.user.hearts.map( obj => obj.toString());
    const operator = hearts.includes(req.params.id) ? '$pull' : '$addToSet';
    const user = await User
        .findByIdAndUpdate(req.user._id, 
            { [operator]: { hearts: req.params.id }},
            { new: true}
        )
    res.json(user);
}

exports.getHearts = async (req, res) => {
    const stores = await Store.find({
        _id: { $in: req.user.hearts }
    });
    res.render('stores', {title: 'Hearted Stores', stores});
};

exports.getTopStores = async (req, res) => {
    const stores = await Store.getTopStores();
    res.render('topStores', {stores, title: 'Top Stores!'});
}