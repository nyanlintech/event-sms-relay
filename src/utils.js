const log = (...args) => {
  if (process.env.DEBUG === "true") {
    console.log(...args);
  }
};

module.exports = { log };
