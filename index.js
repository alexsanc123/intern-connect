import { createApp } from "vue";
import { GraffitiLocal } from "@graffiti-garden/implementation-local";
import { GraffitiRemote } from "@graffiti-garden/implementation-remote";
import { GraffitiPlugin } from "@graffiti-garden/wrapper-vue";


const JoinButton = {
  props: {
    joined: { type: Boolean, required: true }
  },
  emits: ['join'],
  template: `
    <button v-if="!joined" @click="$emit('join')">
      Join
    </button>
    <span v-else class="joined-tag">
      Joined
    </span>
  `
};

createApp({
  
  data() {
    return {
      myMessage: "",
      sending: false,
      channels: ["designftw"],
  
      groupChatName: "",
      creatingGroup: false,
  
      groupChatSchema: {
        properties: {
          value: {
            required: ["activity", "object"],
            properties: {
              activity:   { let: "Create" },
              object: {
                required: ["type", "name", "channel"],
                properties: {
                  type:    { let: "Group Chat" },
                  name:    { type: "string" },
                  channel: { type: "string" },
                  members: {
                    type: "array",
                    items: { type: "string" },
                    default: []
                  }
                }
              }
            }
          }
        }
      },

      currentChat: null,
      selectedChatName: "",

      editingMessage: null,

      renameMode: false,
      renameGroupName: "",

      activeTab: 'Teams',
      bottomNavActive: 'home',
      searchTeams: "",
      searchInterests: "",
      searchEvents: "",

      teams: [
        { name: "International ETFs", members: ["alexandra","john","maría"], tags: ["Trading","ESG","Emerging"] },
        { name: "Options",            members: ["alexandra","taylor","jae"],   tags: ["Trading","Spreads","Greeks"] },
        { name: "Fixed Income",       members: ["alexandra","sam","olivia"], tags: ["Trading","Credit","Bonds"] },
      ],
      interests: [
        { name: "Photography", members: ["alexandra"], tags: ["Art","Camera"] },
        { name: "Running",     members: [],            tags: ["Health","Fitness"] },
        { name: "Crafting",    members: [],            tags: ["DIY","Artisan"] }
      ],
  
      profile: {
        username: "alexandra",
        myChats: [],
        myTeams: ["International ETFs"],
        myInterests: [ "Photography" ]
      },

      chatMembers: {},
      newMember: "",
    };
  },

  computed: {
    messageChannels() {
      return this.currentChat ? [this.currentChat] : [];
    }
  },

  components: {
    JoinButton
  },

  methods: {
    // DATA TRANSFORMATION AND USEFUL
    mergedChats(chatCandidates) {
      let map = {};
      for (let obj of chatCandidates) {
        if (obj.value.activity === "Create") {
          let { channel, name } = obj.value.object;
          map[channel] = { channel, name, members: [] };
        }
        else if (obj.value.describes) {
          let key = obj.value.describes;
          map[key] = map[key] || { channel: key, name: "", members: [] };
          if (obj.value.name) {
            map[key].name = obj.value.name;
          }
          if (Array.isArray(obj.value.members)) {
            map[key].members = obj.value.members;
          }
        }
      }
      return Object.values(map);
    },
    
    filterChatsByGroup(groupName) {
      return this.profile.myChats.filter(chat => 
        chat.name === groupName || 
        (Array.isArray(this.chatMembers[chat.channel]) && 
         this.chatMembers[chat.channel].some(member => {
           let teamMember = this.teams.find(t => t.name === groupName)?.members || [];
           return teamMember.includes(member);
         }))
      );
    },

    // CHAT CREATION AND MANAGEMENT
    async createGroupChat(session) {
      this.creatingGroup = true;
      let newChannel = crypto.randomUUID();
      await this.$graffiti.put(
        {
          value: {
            activity: "Create",
            object: {
              type: "Group Chat",
              name: this.groupChatName,
              channel: newChannel
            }
          },
          channels: ["designftw"],
        },
        session,
      );
      this.profile.myChats.push({
        name: this.groupChatName,
        channel: newChannel});
      this.creatingGroup = false;
      this.groupChatName = "";
      
      await this.$nextTick();
    },

    selectChat(chat, join = true) {
      this.currentChat = chat.channel ?? chat.value.object.channel;
      this.selectedChatName = chat.name ?? chat.value.object.name;
      this.bottomNavActive = 'chats';
      this.chatMembers[this.currentChat] = Array.isArray(chat.members) ? [...chat.members] : [];
      if (!this.profile.myChats.some(c => c.channel === this.currentChat)) {
        this.profile.myChats.push({
          name: this.selectedChatName,
          channel: this.currentChat
        });
      }
      if (join && !this.chatMembers[this.currentChat].includes(this.profile.username)) {
        this.addSelfToChat();
      }
    },
    
    async leaveChat(channelKey) {
      this.profile.myChats = this.profile.myChats.filter(c => c.channel !== channelKey);
  
      if (this.currentChat === channelKey) {
        this.currentChat = null;
        this.selectedChatName = "";
      }
  
      let newMembers = (this.chatMembers[channelKey] || [])
        .filter(u => u !== this.profile.username);
  
      await this.$graffiti.put({
        value: {
          describes: channelKey,
          members: newMembers
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);
    },

    // CHAT CUSTOMIZATION
    rename() {
      this.renameMode = true;
      this.renameGroupName = this.selectedChatName;
      this.$nextTick(() => this.$refs.renameInput.focus());
    },

    async submitRename(session) {
      if (!this.renameGroupName.trim()) return;
      await this.$graffiti.put({
        value: {
          name: this.renameGroupName.trim(),
          describes: this.currentChat
        },
        channels: ["designftw"]
      }, session);
      this.selectedChatName = this.renameGroupName.trim();
      this.renameMode = false;
    },

    // MESSAGE OPERATIONS
    async handleMessage(session) {
      if (!this.myMessage) return;
      if (this.editingMessage) {
        await this.$graffiti.patch({
          value: [
            { op: "replace", path: "/content", value: this.myMessage }
          ]
        }, this.editingMessage, session);
        this.editingMessage = null;
      } else {
        this.sending = true;
        await this.$graffiti.put(
          {
            value: { 
              content: this.myMessage,
              published: Date.now() 
            },
            channels: this.messageChannels
        }, 
        session
      );
        this.sending = false;
      }

      this.myMessage = "";
      await this.$nextTick();
      this.$refs.messageInput.focus();
    },

    edit(message) {
      this.editingMessage = message;
      this.myMessage = message.value.content;
      this.$nextTick(() => this.$refs.messageInput.focus());
    },

    async deleteMessage(message, session) {
      try {
        await this.$graffiti.delete(message, session);
        if (this.editingMessage === message) {
          this.editingMessage = null;
        }
      } catch (err) {
        console.error("Delete failed:", err);
      }
    },

    // MEMBER MANAGEMENT
    async addSelfToChat() {
      if (!this.currentChat || !this.$graffitiSession.value) return;
      
      let newList = [...(this.chatMembers[this.currentChat] || []), this.profile.username].filter((u, i, a) => a.indexOf(u) === i);
      
      this.chatMembers[this.currentChat] = newList;
      
      await this.$graffiti.put({
        value: {
          describes: this.currentChat,
          members: newList
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);

      let teamObj = this.teams.find(t => t.name === this.currentChat);
      if (teamObj) {
        this.joinTeam(teamObj);
      }
      let interestObj = this.interests.find(i => i.name === this.currentChat);
      if (interestObj) {
        this.joinInterest(interestObj);
      }
    },

    async addMember() {
      let user = this.newMember;
      if (!user || !this.currentChat) return;
    
      let list = this.chatMembers[this.currentChat] || [];
      if (list.includes(user)) {
        alert("This user is already a member of the chat.");
        return;
      }

      list.push(user);
      this.chatMembers[this.currentChat] = list;
      this.newMember = "";
    
      await this.$graffiti.put({
        value: {
          describes: this.currentChat,
          members: list
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);
    },
    
    async removeMember(user) {
      if (!this.currentChat) return;
    
      let list = (this.chatMembers[this.currentChat] || [])
        .filter(u => u !== user);
      this.chatMembers[this.currentChat] = list;
    
      await this.$graffiti.put({
        value: {
          describes: this.currentChat,
          members: list
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);
    },
    
    async joinChat(session) {
      let newList = [
        ...(this.chatMembers[this.currentChat] || []),
        this.profile.username
      ].filter((u, i, a) => a.indexOf(u) === i);
  
      await this.$graffiti.put({
        value: {
          describes: this.currentChat,
          members: newList
        },
        channels: ["designftw"]
      }, session);
    },

    openChatOnly({ name, channel }) {
      this.currentChat = channel
      this.selectedChatName = name
      this.bottomNavActive = 'chats'
      this.chatMembers[channel] = this.chatMembers[channel] || []
    },

    // TEAM MANAGEMENT
    joinTeam(teamObj) {
      let name = teamObj.name;
      if (!this.profile.myTeams.includes(name)) {
        this.profile.myTeams.push(name);
      }
      let idx = this.teams.findIndex(t => t.name === name);
      if (idx !== -1) {
        this.teams[idx].members = this.teams[idx].members || [];
        if (!this.teams[idx].members.includes(this.profile.username)) {
          this.teams[idx].members.push(this.profile.username);
        }
      }
    },

    leaveTeam(teamObj) {
      let name = teamObj.name;
      this.profile.myTeams = this.profile.myTeams.filter(t => t !== name);
      let idx = this.teams.findIndex(t => t.name === name);
      if (idx !== -1 && Array.isArray(this.teams[idx].members)) {
        this.teams[idx].members = this.teams[idx].members.filter(m => m !== this.profile.username);
      }
    },

    // INTEREST MANAGEMENT
    joinInterest(interestObj) {
      let name = interestObj.name;
      if (!this.profile.myInterests.includes(name)) {
        this.profile.myInterests.push(name);
      }
      let idx = this.interests.findIndex(i => i.name === name);
      if (idx !== -1) {
        this.interests[idx].members = this.interests[idx].members || [];
        if (!this.interests[idx].members.includes(this.profile.username)) {
          this.interests[idx].members.push(this.profile.username);
        }
      }
    },

    leaveInterest(interestObj) {
      let name = interestObj.name;
      this.profile.myInterests = this.profile.myInterests.filter(i => i !== name);
      let idx = this.interests.findIndex(i => i.name === name);
      if (idx !== -1 && Array.isArray(this.interests[idx].members)) {
        this.interests[idx].members = this.interests[idx].members.filter(m => m !== this.profile.username);
      }
    },
  },
})
  .use(GraffitiPlugin, {
    graffiti: new GraffitiLocal(),
    // graffiti: new GraffitiRemote(),
  })
  .mount("#app");

