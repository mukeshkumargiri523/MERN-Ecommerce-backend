const { User } = require("../model/User");
const crypto = require("crypto");
const { sanitizeUser, sendMail } = require("../service/common");
const jwt = require("jsonwebtoken");

exports.createUser = async (req, res) => {
  try {
    const salt = crypto.randomBytes(16);
    crypto.pbkdf2(
      req.body.password,
      salt,
      310000,
      32,
      "sha512",
      async function (err, hashedPassword) {
        const user = new User({ ...req.body, password: hashedPassword, salt });
        const doc = await user.save();

        req.login(sanitizeUser(doc), (err) => {
          // this also calls serializer and adds to session
          if (err) {
            res.status(400).json(err);
          } else {
            // res.cookie("rememberme", "1", {
            //   expires: new Date(Date.now() + 900000),
            //   httpOnly: true,
            // });
            const token = jwt.sign(
              sanitizeUser(doc),
              process.env.JWT_SECRET_KEY
            );
            res
              .cookie("jwt", token, {
                expires: new Date(Date.now() + 3600000),
                httpOnly: true,
              })
              .status(201)
              .json({ id: doc.id, role: doc.role });
          }
        });
      }
    );
  } catch (err) {
    res.status(400).json(err);
  }
};

exports.loginUser = (req, res) => {
  const user = req.user;
  res
    .cookie("jwt", req.user.token, {
      expires: new Date(Date.now() + 3600000),
      httpOnly: true,
    })
    .status(201)
    .json({ id: user.id, role: user.role });
};

exports.logout = (req, res) => {
  res
    .cookie("jwt", null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .sendStatus(200);
};

exports.checkAuth = async (req, res) => {
  if (req.user) {
    res.json(req.user);
  } else {
    res.sendStatus(401);
  }
};

exports.resetPasswordRequest = async (req, res) => {
  const email = req.body.email;
  const user = await User.findOne({ email: email });
  if (user) {
    const token = crypto.randomBytes(48).toString("hex");
    user.resetPasswordToken = token;
    await user.save();
    //set token in email
    const resetPage =
      "https://megakart-react-ecommerce.onrender.com/reset-password?token=" +
      token +
      "&email=" +
      email;
    const subject = "reset Password for ecommerce";
    const html = `<p> Click <a href='${resetPage}'>here </a> to Reset Password </p>`;
    //let send email and token in the mail body so we can verify that user is geniune
    if (email) {
      const response = await sendMail({ to: email, subject, html });
      res.send(response);
    } else {
      res.sendStatus(400);
    }
  } else {
    res.sendStatus(400);
  }
};

exports.resetPassword = async (req, res) => {
  const { email, password, token } = req.body;

  const user = await User.findOne({ email: email, resetPasswordToken: token });
  if (user) {
    const salt = crypto.randomBytes(16);
    crypto.pbkdf2(
      req.body.password,
      salt,
      310000,
      32,
      "sha512",
      async function (err, hashedPassword) {
        user.password = hashedPassword;
        user.salt = salt;
        await user.save();
        const subject = " Password change Successfully";
        const html = `<p> Successfully Reset Password </p>`;
        if (email) {
          const response = await sendMail({ to: email, subject, html });
          res.send(response);
        } else {
          res.sendStatus(400);
        }
      }
    );
  } else {
    res.sendStatus(400);
  }
};
