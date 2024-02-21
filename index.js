const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { error, log } = require("console");

app.use(express.json());
app.use(cors());

//database connection with MongoDb
mongoose.connect("mongodb+srv://huynhca2k2:0947079663Aa@cluster0.nya944o.mongodb.net/e-ecommerce");

//api creation
app.get("/", (req, res) =>{
    res.send("hello");
});

//image storage engine
const storage = multer.diskStorage({
    destination: './upload/images',
    filename:(req, file, cb) =>{
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({storage:storage})

//creating upload endpoint for images
app.use('/images', express.static(path.join(__dirname, 'upload/images')));

app.post("/upload", upload.single('product'), (req, res) => {
    res.json({
        success:1,
        image_url:`https://api-node-tiki.onrender.com/images/${req.file.filename}`
    })
})

//schema for creating products
const Product = mongoose.model("Product",{
    id:{
        type: Number,
        required: true,
    },
    name:{
        type: String,
        required: true,
    },
    image:{
        type: String,
        required: true,
    },
    category:{
        type: String,
        required: true,
    },
    new_price:{
        type: Number,
        required: true,
    },
    old_price:{
        type: Number,
        required: true,
    },
    date:{
        type: Date,
        default: Date.now(),
    },
    avilable:{
        type: Boolean,
        default: true,
    }

})

//schema creating for user model
const Users = mongoose.model('Users',{
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,

    },
    cartData: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
        },
        quantity: {
            type: Number,
            default: 1, // Giá trị mặc định cho quantity
        },
    }],
    date:{
        type:Date,
        default:Date.now,
    }
})

//creating endpoint for registering the user
app.post('/signup', async (req,res) => {

    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false, errors:"exising user found with same email address"})
    }
    
    const user = new Users({
        name:req.body.username,
        email:req.body.email,
        password:req.body.password,
        cartData:[],
    })

    await user.save();

    const data ={
        user:{
            id:user.id
        }
    }

    const token = jwt.sign(data, 'secret_ecom');
    res.json({success:true, token})
})

//creating endpoint for userlogin
app.post('/login',async (req,res)=>{
    let user = await Users.findOne({email:req.body.email});
    if(user){
        const passCompare = req.body.password === user.password;
        if(passCompare){
            const data = {
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data, 'secret_ecom');
            res.json({success:true, token});
        }
        else{
            res.json({success:false, errors:"Wrong Password"});

        }
    }
    else{
        res.json({success:false, errors:"Wrong Email Id"});
    }
})

app.post('/addproduct', async (req, res) =>{
    let randomNumber = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
    const product = new Product({
        id:randomNumber,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,

    });

    console.log(product);
    await product.save();
    console.log("saved")
    res.json({
        success:true,
        name:req.body.name,
    })
})

//creating api delete product
app.post('/removeproduct', async (req, res) =>{
    await Product.findOneAndDelete({
        id:req.body.id
    });
    console.log("remove");
    res.json({
        success: true,
        name: req.body.name
    })
})

//api get allproduct
app.get('/allproducts', async (req, res) =>{
    let products = await Product.find({});
    console.log("get all product");
    res.send(products);
})

//
app.listen(port, (error) =>{
    if(!error){
        console.log("server running on port "+ port);
    }else{
        console.log("error : "+ error);
    }
})

//creating endpoint for newcollection data
app.get('/newcollections', async (req, res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("new collection fetched");
    res.send(newcollection);
})

//creating endpoint for popular in women section
app.get('/popularinwomen', async (req, res) =>{
    let products = await Product.find({category:"women"});
    let popular_in_women = products.slice(0,4);
    console.log("popular collection fetched");
    res.send(popular_in_women);
})

//creating middelware to fetch user
const fetchUser = async (req, res, next) =>{
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"please authenticate using a valid token"})
    }else{
        try{
            const data = jwt.verify(token, 'secret_ecom');
            req.user = data.user;
            next();
        }catch(error){
            res.status(401).send({errors:"please authenticate using a valid token"})
        }
    }
}

//api add product to cart and quantity
app.post('/addtocart', fetchUser, async (req, res) => {
    try {
        const userId = req.user.id;
        let product = await Product.findOne({ id: req.body.itemId });

        const user = await Users.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const existingProductIndex = user.cartData.findIndex(item => {
            if (item.product && typeof item.product === 'object') {
                return item.product.equals(product._id);
            }
            return false;
        });

        if (existingProductIndex !== -1) {
            user.cartData[existingProductIndex].quantity += 1;
        } else {
            user.cartData.push({ product: product._id, quantity: 1 });
        }

        await user.save();

        res.status(200).json({ message: 'Product added to cart successfully' });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});




//creating endpoint for product in cart
app.get('/productincart', fetchUser, async (req, res) => {
    try {
        const user = await Users.findById(req.user.id).populate('cartData.product');
        const productsInCart = user.cartData.map(item => ({
            id: item.product.id,
            name: item.product.name,
            image: item.product.image,
            new_price: item.product.new_price,
            old_price: item.product.old_price,
            quantity: item.quantity 
        }));

        res.json(productsInCart);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
    }
});

//remove product in to cart
app.post('/removeformcart', fetchUser, async (req, res) => {
    try {
        const userId = req.user.id;
        let product = await Product.findOne({ id: req.body.itemId });

        const user = await Users.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const existingProductIndex = user.cartData.findIndex(item => {
            if (item.product && typeof item.product === 'object') {
                return item.product.equals(product._id);
            }
            return false;
        });

        if (existingProductIndex !== -1) {
            if (user.cartData[existingProductIndex].quantity > 1) {
                user.cartData[existingProductIndex].quantity -= 1;
            } else {
                user.cartData.splice(existingProductIndex, 1);
            }
            await user.save();
            res.status(200).json({ message: 'Product removed from cart successfully' });
        } else {
            res.status(404).json({ error: 'Product not found in cart' });
        }
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});





