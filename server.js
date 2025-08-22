const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');

// --- Initialize App ---
const app = express();
// const PORT = 3000;
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

// --- Database Connection (for local MongoDB) ---
const dbURI = 'mongodb://127.0.0.1:27017/campus-eats';
mongoose.connect(dbURI)
    .then(() => console.log('Successfully connected to local MongoDB!'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));

// --- Mongoose Models ---
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', UserSchema);

// --- Middleware Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// --- Session Configuration ---
app.use(session({
    secret: 'a secret key to sign the cookie',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// This middleware makes the 'user' variable available to all EJS templates.
app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
});

// --- Expanded Mock Database for Canteens ---
const db = {
    universities: ["Vellore Institute of Technology", "SRM University", "IIT Madras", "Amity University", "Manipal University", "Delhi University", "Christ University", "BITS Pilani"],
    canteens: [
        { id: 1, university: "Vellore Institute of Technology", name: "SJT Canteen", menu: [{ name: "Veg Fried Rice", price: 120 }, { name: "Gobi Manchurian", price: 110 }] },
        { id: 2, university: "Vellore Institute of Technology", name: "Darling Bakery", menu: [{ name: "Black Forest Pastry", price: 80 }, { name: "Chicken Puff", price: 50 }] },
        { id: 3, university: "Vellore Institute of Technology", name: "Foodys", menu: [{ name: "Classic Burger", price: 130 }, { name: "Peri Peri Fries", price: 100 }] },
        { id: 4, university: "SRM University", name: "Java", menu: [{ name: "Cold Coffee", price: 100 }, { name: "Brownie", price: 90 }] },
        { id: 5, university: "SRM University", name: "Food Court", menu: [{ name: "Chole Bhature", price: 110 }, { name: "Pav Bhaji", price: 100 }] },
        { id: 6, university: "IIT Madras", name: "Ram's Cafe", menu: [{ name: "Idli Sambar", price: 40 }, { name: "Masala Dosa", price: 60 }] },
        { id: 7, university: "Amity University", name: "Arcadia", menu: [{ name: "Chilli Potato", price: 130 }, { name: "Veg Noodles", price: 140 }] },
        { id: 8, university: "Manipal University", name: "Dollops", menu: [{ name: "Cheese Sandwich", price: 70 }, { name: "Fruit Juice", price: 50 }] },
    ]
};

// --- Page & Auth Routes ---

// Home page
app.get('/', (req, res) => {
    res.render('index', { universities: db.universities });
});

// Canteens page
app.get('/canteens', (req, res) => {
    const universityQuery = req.query.university;
    const filteredCanteens = db.canteens.filter(c => c.university.toLowerCase() === universityQuery.toLowerCase());
    res.render('canteens', { university: universityQuery, canteens: filteredCanteens });
});

// Menu page
app.get('/menu/:canteenId', (req, res) => {
    const canteenId = parseInt(req.params.canteenId, 10);
    const canteen = db.canteens.find(c => c.id === canteenId);
    if (canteen) {
        res.render('menu', { canteen });
    } else {
        res.status(404).send('Canteen not found');
    }
});

// Deliverers page
app.get('/deliverers', (req, res) => res.render('deliverers'));

// Add Canteen page
app.get('/add-canteen', (req, res) => res.render('add-canteen'));

// Help page
app.get('/help', (req, res) => res.render('help'));

// GET Signup Page
app.get('/signup', (req, res) => res.render('signup'));

// POST Signup Handler
app.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.redirect('/login');
    } catch (error) {
        res.send('This email is already taken. Please try another.');
    }
});

// GET Login Page
app.get('/login', (req, res) => res.render('login'));

// POST Login Handler
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = { id: user._id, name: user.name, email: user.email };
            res.redirect('/');
        } else {
            res.send('Invalid email or password.');
        }
    } catch (error) {
        res.send('Error logging in.');
    }
});

// Logout Handler
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// --- NEW: Checkout and Order Routes ---

// Checkout page
app.post('/checkout', (req, res) => {
    const { canteenName, items } = req.body;
    const itemQuantities = new Map();

    if (items) {
        const itemsArray = Array.isArray(items) ? items : [items];
        itemsArray.forEach(itemString => {
            const [name, price] = itemString.split('|');
            if (itemQuantities.has(name)) {
                itemQuantities.get(name).quantity++;
            } else {
                itemQuantities.set(name, { price: parseFloat(price), quantity: 1 });
            }
        });
    }
    
    const aggregatedItems = Array.from(itemQuantities.entries()).map(([name, data]) => ({ name, ...data }));

    res.render('checkout', { canteenName: canteenName || 'Your', items: aggregatedItems });
});

// "Place Order" handler
app.post('/place-order', (req, res) => {
    const { paymentMethod } = req.body;
    if (paymentMethod) {
        console.log(`Order placed with payment method: ${paymentMethod}`);
        res.redirect('/order-success');
    } else {
        res.status(400).send('Please select a payment method.');
    }
});

// "Order Success" page
app.get('/order-success', (req, res) => {
    res.render('order-success');
});


// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
