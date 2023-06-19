import 'dotenv/config'
import fetch from 'node-fetch'
import FormData from 'form-data'

class apiWrapper {
    url;
    token;

    constructor() {
        this.url = 'https://rep4rep.com/pub-api'
        this.token = process.env.REP4REP_KEY
    }

    buildForm(params) {
        let form = new FormData()
        form.append('apiToken', this.token)
        for (const [k, v] of Object.entries(params)) {
            form.append(k, v)
        }
        return form
    }

    async addSteamProfile(steamId) {
        return await fetch(`${this.url}/user/steamprofiles/add`, {
            method: 'post',
            body: this.buildForm({ steamProfile: steamId})
        }).then(response => response.json())
    }

    async getSteamProfiles() {
        return await fetch(`${this.url}/user/steamprofiles?apiToken=${this.token}`, {
            method: 'get'
        }).then(response => response.json())
    }

    async getTasks(r4rSteamId) {
        return await fetch(`${this.url}/tasks?apiToken=${this.token}&steamProfile=${r4rSteamId}`, {
            method: 'get'
        }).then(response => response.json())
    }

    async completeTask(taskId, commentId, authorSteamProfileId) {
        return await fetch(`${this.url}/tasks/complete`, {
            method: 'post',
            body: this.buildForm({ 
                taskId: taskId,
                commentId: commentId,
                authorSteamProfileId: authorSteamProfileId
            })
        }).then(response => response.json())
    }

}

const instance = new apiWrapper()
export {instance as default}