# rep4rep-bot

Automatic Steam Comment bot example for [rep4rep](https://rep4rep.com/).

Using the [rep4rep](https://rep4rep.com/) public API.


## Steam Comment bot setup

1. clone the repository

```bash
git clone https://github.com/rep4rep/rep4rep-bot.git
```

2. navigate into dir 

```bash
cd rep4rep-bot
```

3. install packages

```bash
npm install
```

## Config
`.env` requires your rep4rep API token.

An API token can be obtained [here](https://rep4rep.com/user/settings/).
> Never share your rep4rep apiToken with anyone.

## Commands
```bash
node main.js <option>
```

Auto run
```bash
--run
```

List profiles
```bash
--profiles
```

Authorize profiles
```bash
--auth-profiles
```

Add profile
```bash
--add-profile username:password
```

Remove profile
```bash
--remove-profile username
```

## Support
https://discord.com/invite/S8hsc4MCHf
