import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import env from"dotenv";
env.config()
const app =express();
const port=3000;
const Saltround=10;

app.use(express.static("public"));

app.use(session({
    secret:process.env.SECRET_KEY,
    resave: false,
    saveUninitialized:true,
    cookie: {
        // to define cookie life we will do 1000milisec*60sec*60min*24hr
        maxAge:1000*60*60*24
      }
}));

///////////////passport intialization////////////////////////////////////////////
app.use(passport.initialize());
/////////////////passport seasion saving///////////////////////////////////
app.use(passport.session());

/////////////////////////////// Initializing the prostgres data base /////////////////////////////////////////////////////////////////////////
const db=new pg.Client({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD ,
    port: process.env.PG_PORT,
});

db.connect();



async function getdata(){
    const result=await db.query("SELECT * FROM book_list JION user ON book_list.user_id=user.id");
    // console.log(result.rows);
    return result.rows;
}
////////landing page/////////////////////////
app.get("/",(req, res) => {
    res.render("landing.ejs")
})
////////////////////////////////login page////////////////////////
app.get("/Login",(req, res) => {
    res.render("login.ejs")
});
////////////////////////////logout system////////////////////
app.get("/logout",(req, res) => {
    req.logout(function (err) {
        if (err) {
          return next(err);
        }
        res.redirect("/");
      });

})
////////////////////////////Sign in page///////////////////
app.get("/Singin",(req, res) => {
    res.render("signin.ejs")
});

/////////////////////login system////////////////////////
app.post("/login",
    passport.authenticate("local",{
    successRedirect:"/books",
    failureRedirect:"/Login"
})
);


///////////////////sign in system/////////////////////
app.post("/signin",async(req, res) => {
    const Email_id=req.body.new_email_id;
    const User_name= req.body.new_username;
    const Password=req.body.new_password;
    try{
        const Checkemailid= await db.query('SELECT * FROM "user" WHERE email_id= $1',[Email_id]);
        if(Checkemailid.rows.length>0){
            res.send("Email already exist try to login");
        }
        else{
            bcrypt.hash(Password,Saltround,async(err,hash)=>{
                if(err){
                    console.log("Error to hash password:",err);
                }
                else{
                    console.log("Hashed Password:",hash);
                    const result = await db.query('INSERT INTO "user"(user_name,email_id,password)VALUES($1 ,$2, $3) RETURNING *',[User_name,Email_id,hash]);
                    console.log(result);
                    const User=result.rows[0];
                    console.log(User);
                    req.login(User,(err)=>{
                       
                            console.log(err);
                       
                            res.redirect("/books");
                      

                    })
                }
            })
        }
    }
    catch(err){
        console.log(err);
    }


});

//////////////login throught google system///////////
app.get("/auth/google",passport.authenticate("google",{
    scope:["profile","email"],
}));
app.get("/auth/google/books",passport.authenticate("google",{
    successRedirect:"/books",
    failureRedirect:"/Login"
}))
//////////////////////////////////////////



////////////// home page////////////////////////
app.get("/books",async(req, res)=>{
    console.log(req.user);
    console.log(req.isAuthenticated());
    
    if(req.isAuthenticated()){
    const result=await db.query('SELECT * FROM book_list JOIN "user" ON book_list.user_id="user".id');
   
   
    console.log(result.rows);
    const data=result.rows;
    console.log(req.user.user_image);
    
    res.render('home.ejs',{listofitems:data})
    }
    else{
        res.redirect("/Login");
    }
});

///////////////Contact page/////////////////////
app.get("/contact",(req, res)=>{
    if(req.isAuthenticated()){
        res.render('contact.ejs')
      }
      else{
        res.redirect("/Login");
      }
    
});
/////////////////////User Area/////////////////////
app.get("/devmode",async(req, res)=>{
    if(req.isAuthenticated()){
    const result=await db.query("SELECT * FROM book_list WHERE user_id=$1",[req.user.id]);
    const data=result.rows;
    var Noentryexits=true;
    if(result.rows.length>0){
        Noentryexits=false;

    }
    else{
        Noentryexits=true;
    }
    console.log(Noentryexits);
    console.log(req.user.user_image);
   
    res.render('edit.ejs',{isNoentry:Noentryexits, listofitems:data,User_img:req.user.user_image ,User_name:req.user.user_name})
    }
    else{
        res.render('/Login');
    }
});
///////////////////////////////////////////// To add a newbook /////////////////////////////////////////////////////////////////////
app.post("/post",(req, res)=>{
    const isbn=req.body.NewItemIsbn;
    const booktitle=req.body.NewItemBooktitle;
    const booksummery=req.body.NewItemSummery;
    const booknote=req.body.NewItemNote;
    const bookauthor=req.body.NewItemAuthor;
    const book_link=req.body.NewItemPurchaseLink;
    const book_rating=req.body.NewItemBookRate;
    const upload_date= new Date().getDate() +"/"+ new Date().getMonth()+"/"+ new Date().getFullYear();

    db.query("INSERT INTO book_list(book_name,summery_of_book,short_note_of_book,isbn,author_name,amazon_link,book_rate,user_id,date_of_upload)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",[booktitle,booksummery,booknote,isbn,bookauthor,book_link,book_rating,req.user.id,upload_date]);
    res.redirect("/books");
});
/////////////////////////////////////////////// To edit a book ///////////////////////////////////////////////////////////////////////
app.post("/edit",(req, res)=>{
    const Updated_Id=req.body.updatedItemId;
    const Updated_Isbn=req.body.updatedItemIsbn;
    const Updated_Title=req.body.updatedItemTitle;
    const Updated_Rating=req.body.updatedItemRate;
    const Updated_Summary=req.body.updatedItemSummery;
    const Updated_Note=req.body.updatedItemNote;
    const Updated_Author=req.body.updatedItemAuthor;
    const Updated_book_link=req.body.updatedbookLink;
    db.query("UPDATE book_list SET book_name=($1),summery_of_book=($2),book_rate=($3),short_note_of_book=($4),isbn=($5), author_name=($6),amazon_link=($7) WHERE id=($8)",[Updated_Title,Updated_Summary,Updated_Rating,Updated_Note,Updated_Isbn,Updated_Author,Updated_book_link,Updated_Id]);
    res.redirect("/books");
});
////////////////////////////////////////////////// To delete a book /////////////////////////////////////////////////////////////////
app.post("/delete",(req, res) => {
    const Deleted_Item_Id=req.body.deleteItemId;
    db.query("DELETE FROM book_list WHERE id=($1)",[Deleted_Item_Id]);
    res.redirect("/books");
});

app.get("/books/:name",async(req, res) => {
    let name= req.params.name;
    console.log(name);
    const book_detail=await db.query('SELECT * FROM book_list JOIN "user" ON book_list.user_id="user".id WHERE book_name=($1)',[name]);
    console.log(book_detail.rows);
    res.render("book.ejs",{BOOK:book_detail.rows})

})

////////////////////////////////////////////////AUTHENTICATION///////////////////////////////////////////////////////////////////////////////////////////////////


//////////////////////////////////////////////////////////// local authentication////////////////////////////////////////////////////////////////////////////
// passport.use("local",new Strategy(async function verify(login_email_id,login_password,cb){
//     try{
//         const result=await db.query("SELECT * FROM user WHERE email_id=$1",[login_email_id,]);
//         if(result.rows.length>0){
//             const user=result.rows[0];
//             console.log(user);
//             const storedhashedpassword=user.password;
//         }
//     }catch(err){

//     }
// }))

// passport.use( "local", new Strategy(async function verify(login_email_id,login_password,cb){
//     try {
//       const result = await db.query("SELECT * FROM user WHERE email_id = $1", [
//         login_email_id,
//       ]);
//       if (result.rows.length > 0) {
//         console.log(result.rows);
//         const user = result.rows[0];
//         const storedHashedPassword = user.password;
//         bcrypt.compare(login_password, storedHashedPassword, (err, result) => {
//           if (err) {
//             return cb (err);
//           } else {
//             if (result) {
//               return cb (null,user);
//             } else {
//               return cb(null,false);
//             }
//           }
//         });
//       } else {
//         return cb("User not found");
//       }
//     } catch (err) {
//       return cb(err);
//     }
  
//   }));




 
//////////////////////////////////////////////////////////////////// Google authentication////////////////////////////////////////////////////////////////////
passport.use("google",new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:"http://localhost:3000/auth/google/books",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",

},async function(acessToken,refreshToken,profile,cb){
    console.log(profile);
    try{
        var user_email=profile.email;
        var user_username=profile.displayName;
        var user_image=profile.picture;
        const result=await db.query('SELECT * FROM "user" WHERE email_id=$1',[user_email]);
        
        if(result.rows.length===0){
           const newuser= db.query('INSERT INTO "user"(user_name,email_id,password,user_image)VALUES($1 ,$2, $3,$4)',[user_username,user_email,process.env.GOOGLE_USERS_PASSWORD,user_image]);
            console.log(newuser);
            cb(null,newuser.rows[0]);
        }
        else{
            // already exist
            console.log(result);
             cb(null,result.rows[0]);
        }
    }
    catch(err){
        console.log(err);
    }

}));

///////////////////////////////////////Local Authentication////////////////////////////
passport.use(
    "local",
    new Strategy(async function verify(username, password , cb) {
        console.log(username);
        console.log(password);
      try {
        const result = await db.query('SELECT * FROM "user" WHERE email_id=$1 ', [username]);
        if (result.rows.length > 0) {
          const user = result.rows[0];
          const storedHashedPassword = user.password;
          bcrypt.compare(password, storedHashedPassword, (err, valid) => {
            console.log(valid);
            if (err) {
              console.error("Error comparing passwords:", err);
              return cb(err);
            } else {
              if (valid) {
                
                return cb(null, user);
              } else {
                return cb(null, false);
              }
            }
          });
        } else {
          return cb("User not found");
        }
      } catch (err) {
        console.log(err);
      }
    })
  );




passport.serializeUser((user,cb)=>{
    cb(null,user);
});
passport.deserializeUser((user,cb)=>{
    cb(null,user);
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}/`);
  });

