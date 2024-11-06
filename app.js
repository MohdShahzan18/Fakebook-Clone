const express = require("express")
const userModel = require("./models/user")
const postModel = require("./models/post")
const path = require("path")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser")
const upload = require("./config/multerconfig")

const app = express()

app.set("view engine", "ejs")
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, "public")))
app.use(cookieParser())

app.get('/', (req, res) => {
  res.render("index")
})

app.get('/login', async (req, res) => {
  res.render("login")
})

app.get('/profile/upload', isLoggedIn, async (req, res) => {
  res.render("profileupload")
})

app.post('/upload', isLoggedIn, upload.single("image"), async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email })
  user.profilepic = req.file.filename
  await user.save()
  res.redirect('/profile')
})

app.get('/profile', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email }).populate("posts")
  res.render("profile", { user })
})

app.get('/like/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user")

  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid)
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1)
  }

  await post.save()
  res.redirect("/profile")
})

app.get('/edit/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id })
  res.render("edit", { post })
})

app.post('/update/:id', isLoggedIn, async (req, res) => {
  let post = await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content })
  res.redirect("/profile")
})

app.post('/post', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email })
  let { content } = req.body;

  let post = await postModel.create({
    user: user._id,
    content
  })

  user.posts.push(post._id)
  await user.save()
  res.redirect('/profile')
})

// New route for deleting a post
app.post('/delete/:id', isLoggedIn, async (req, res) => {
  try {
    let post = await postModel.findOne({ _id: req.params.id, user: req.user.userid })
    if (!post) {
      return res.status(404).send("Post not found or unauthorized")
    }

    // Delete the post
    await postModel.deleteOne({ _id: req.params.id })

    // Remove the post from the user's posts array
    await userModel.updateOne(
      { _id: req.user.userid },
      { $pull: { posts: req.params.id } }
    )

    res.redirect('/profile')
  } catch (err) {
    console.error(err)
    res.status(500).send("Error deleting post")
  }
})

app.post('/register', async (req, res) => {
  let { username, name, email, password, age } = req.body;

  let user = await userModel.findOne({ email })
  if (user) return res.status(500).send("User already registered")

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let createdUser = await userModel.create({
        username,
        name,
        email,
        password: hash,
        age
      })
      let token = jwt.sign({ email, userid: createdUser._id }, "topsecret")
      res.cookie("token", token)
      res.redirect("/login")
    })

  })
})

app.post('/login', async (req, res) => {
  let { email, password } = req.body;

  let user = await userModel.findOne({ email })
  if (!user) return res.status(500).send("Something went wrong")

  bcrypt.compare(password, user.password, (err, result) => {
    if (result) {
      let token = jwt.sign({ email, userid: user._id }, "topsecret")
      res.cookie("token", token)
      res.status(200).redirect("/profile")
    }
    else return res.redirect('/login')
  })
})

app.get('/logout', (req, res) => {
  res.cookie("token", "")
  res.redirect('/login')
})

function isLoggedIn(req, res, next) {
  if (req.cookies.token === "") res.redirect("/login")
  else {
    let data = jwt.verify(req.cookies.token, "topsecret")
    req.user = data
    next()
  }
}

app.listen(3000, () => {
  console.log("Server listening on port http://localhost:3000");
})