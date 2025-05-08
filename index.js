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

const ProfileCard = {
  name: 'ProfileCard',
  props: {
    profile: { type: Object, required: true }
  },
  template: `
    <div class="profile-card">
      <h3 class="profile-card__header">
        {{ profile.name }}<span v-if="profile.age">, {{ profile.age }}</span>
        <small v-if="profile.college">— {{ profile.college }}</small>
      </h3>
      <p>
        <strong>Interests:</strong>
        <span v-if="profile.interests.length === 0">None</span>
        <span
          v-for="item in profile.interests"
          :key="item"
          class="profile-card__tag"
        >{{ item }}</span>
      </p>
      <p>
        <strong>Teams:</strong>
        <span v-if="profile.teams.length === 0">None</span>
        <span
          v-for="team in profile.teams"
          :key="team"
          class="profile-card__tag"
        >{{ team }}</span>
      </p>
      <p>
        <strong>Chats:</strong>
        <span v-if="profile.chats.length === 0">None</span>
        <span
          v-for="chat in profile.chats"
          :key="chat"
          class="profile-card__tag"
        >{{ chat }}</span>
      </p>
    </div>
  `
};

const ProfileForm = {
  name: 'ProfileForm',
  props: {
    modelValue: {
      type: Object,
      required: true
    },
    saving: {
      type: Boolean,
      required: true
    }
  },
  emits: ['update:modelValue', 'save'],
  computed: {
    form: {
      get() { return this.modelValue },
      set(val) { this.$emit('update:modelValue', val) }
    },
  },
  template: `
    <form class="profile-form" @submit.prevent="$emit('save')">
      <label>
        Name
        <input v-model="form.name" required />
      </label>

      <label>
        Age
        <input type="number" v-model.number="form.age" min="0" required />
      </label>

      <label>
        College
        <input v-model="form.college" />
      </label>

      <div class="profile-form__readonly">
        <strong>Interests: </strong>
        <span v-if="form.interests.length === 0">None</span>
        <span
          v-for="item in form.interests"
          :key="item"
          class="profile-card__tag"
        >{{ item }}, </span>
      </div>

      <!-- read-only teams -->
      <div class="profile-form__readonly">
        <strong>Teams: </strong>
        <span v-if="form.teams.length === 0">None</span>
        <span
          v-for="team in form.teams"
          :key="team"
          class="profile-card__tag"
        >{{ team }}, </span>
      </div>

      <button type="submit" :disabled="saving">
      <span v-if="saving" class="spinner"></span>
      <span v-if="!saving">Save Profile</span>
      <span v-else>Saving…</span>
    </button>
    </form>
  `
};

const ProfileLoader = {
  name: 'ProfileLoader',
  props: ['data'],
  mounted() {
    this.$emit('loaded', this.data);
  },
  render() { return null; }
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

      currentTeam: null,
      teamActiveTab: 'Members',

      currentInterest: null,
      interestActiveTab: 'Members',

      editingMessage: null,

      renameMode: false,
      renameGroupName: "",

      activeTab: 'Teams',
      bottomNavActive: 'home',
      searchTeams: "",
      searchInterests: "",
      searchEvents: "",

      teams: [
        { name: "International ETFs", membersCount: 0 },
        { name: "Options", membersCount: 0},
        { name: "Fixed Income", membersCount: 0},
        { name: "Data Science", membersCount: 0 },
        { name: "Blockchain Dev", membersCount: 0 },
        { name: "Product Management", membersCount: 0 },
        { name: "Equity Research", membersCount: 0 },
        { name: "Sales", membersCount: 0 },
      ],
      interests: [
        { name: "Photography", membersCount: 0},
        { name: "Running", membersCount: 0},
        { name: "Crafting", membersCount: 0},
        { name: "Travel", membersCount: 0 },
        { name: "Chess", membersCount: 0 },
        { name: "Yoga", membersCount: 0 },
        { name: "Cooking", membersCount: 0 }
      ],

      profileData: {
        name: '',
        age: null,
        college: '',
        interests: [],
        teams: [],
        chats: []
      },

      chatMembers: {},
      newMember: "",

      addingEvent: false,
      newEvent: {
        name: '',
        location: '',
        date: '',
        time: '',
        teams: [],
        interests: []
      },

      savingProfile: false,
      showSaveToast: false,
    };
  },

  computed: {
    messageChannels() {
      if (this.currentTeam && this.teamActiveTab === 'Chat') {
        return [ this.currentTeam.name ];
      }
      return this.currentChat ? [ this.currentChat ] : [];
    }

  },

  components: {
    JoinButton, ProfileCard, ProfileForm, ProfileLoader
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
      this.profileData.chats.push({
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
      if (!this.profileData.chats.some(c => c.channel === this.currentChat)) {
        this.profileData.chats.push({
          name: this.selectedChatName,
          channel: this.currentChat
        });
        if (join) this.saveProfile();
      }
      if (join && !this.chatMembers[this.currentChat].includes(this.profileData.name)) {
        this.addSelfToChat();
      }
    },
    
    async leaveChat(channelKey) {
      this.profileData.chats = this.profileData.chats.filter(c => c.channel !== channelKey);
      await this.saveProfile();
      await this.$graffiti.put({
        value: {
          describes: channelKey,
          members: this.chatMembers[channelKey].filter(u=>u!==this.profileData.name)
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);

      if (this.currentChat === channelKey) {
        this.currentChat = null;
        this.selectedChatName = "";
      }  
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
    initProfile(data) {
      this.profileData = {...data};
    },

    async addSelfToChat() {
      if (!this.currentChat || !this.$graffitiSession.value) return;
      
      let newList = [...(this.chatMembers[this.currentChat] || []), this.profileData.name].filter((u, i, a) => a.indexOf(u) === i);
      
      this.chatMembers[this.currentChat] = newList;
      
      await this.$graffiti.put({
        value: {
          describes: this.currentChat,
          members: newList
        },
        channels: ["designftw"]
      }, this.$graffitiSession.value);

      await this.saveProfile();

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
        this.profileData.name
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

    // commented from studio
    async saveProfile() {
      const start = Date.now();
      this.savingProfile = true;
      await this.$graffiti.put({
        value: this.profileData,
        channels: [ this.$graffitiSession.value.actor ]
      }, this.$graffitiSession.value);
      const elapsed = Date.now() - start;
      if (elapsed < 500) {
          await new Promise(r => setTimeout(r, 500 - elapsed));
     }
      this.savingProfile = false;
      this.showSaveToast = true;
      setTimeout(() => this.showSaveToast = false, 2000);
    },

    // commented from studio
    // async saveProfile() {
    //   await this.$graffiti.put(
    //     {
    //       value: {
    //         ...this.profileData,
    //         generator: "https://alexsanc123.github.io/intern-connect/",
    //         describes: this.$graffitiSession.value.actor
    //       },
    //       channels: [
    //         this.$graffitiSession.value.actor,
    //         "designftw-2025-studio1"
    //       ]
    //     }, this.$graffitiSession.value);
    // },
    

    

    // INTEREST MANAGEMENT
    async joinInterest() {
      await this.$graffiti.put({
        value: {
          userId: this.$graffitiSession.value.actor,
          displayName: this.$graffitiSession.value.actor
        },
        channels: [ this.currentInterest.name ]
      }, this.$graffitiSession.value);
      this.profileData.interests.push(this.currentInterest.name);
      await this.saveProfile(); 
      confetti({ particleCount: 120, spread: 120, origin: { y: .8 } });                               
    },

    async leaveInterest(memberObj) {
      if (memberObj) {
        await this.$graffiti.delete(memberObj, this.$graffitiSession.value);
        this.profileData.interests = this.profileData.interests.filter(name => name !== this.currentInterest.name);
        await this.saveProfile();
      }
    },

    async openInterest(interest, initialTab = 'Members') {
        this.currentInterest   = interest;
        this.interestActiveTab = initialTab;
    },
  
    async backToInterests() {
      this.currentInterest = null;
    },

    // TEAM MANAGEMENT
    async joinTeam() {
      await this.$graffiti.put({
        value: {
          userId: this.$graffitiSession.value.actor,
          displayName: this.$graffitiSession.value.actor
        },
        channels: [ this.currentTeam.name ]
      }, this.$graffitiSession.value); 
      this.profileData.teams.push(this.currentTeam.name);
      await this.saveProfile();
      confetti({ particleCount: 120, spread: 120, origin: { y: .8 } });                            
    },

    async leaveTeam(memberObj) {
      if (memberObj) {
        await this.$graffiti.delete(memberObj, this.$graffitiSession.value);
        this.profileData.teams = this.profileData.teams.filter(name => name !== this.currentTeam.name);
        await this.saveProfile();
      }
    },

    async openTeam(team, initialTab = 'Members') {
        this.currentTeam   = team;
        this.teamActiveTab = initialTab;
    },
  
    async backToTeams() {
      this.currentTeam = null;
      this.myMembershipUrl = null;
    },
  
    openChatWithMember(member) {
      this.selectChat({
      name: member.displayName || member.username,
      channel: member.id
      })
    },

    openEventForm() {
      this.addingEvent = true;
      if (this.currentTeam) {
        this.newEvent.teams =  [ this.currentTeam.name ];
        this.newEvent.interests = [];
      }
      else if (this.currentInterest) {
        this.newEvent.teams = [];
        this.newEvent.interests = [ this.currentInterest.name ];
      }
      else {
        this.newEvent.teams = [];
        this.newEvent.interests = [];
      }
    },

    cancelEventForm() {
      this.addingEvent = false;
      this.newEvent = {
        name: '',
        location: '',
        date: '',
        time: '',
        teams: [],
        interests: []
      };
    },

    async createEvent(session) {
      const date = new Date(`${this.newEvent.date}T${this.newEvent.time}`);
      await this.$graffiti.put({
        value: {
          name:      this.newEvent.name,
          location:  this.newEvent.location,
          datetime:  date.getTime(),
          teams:      this.newEvent.teams,
          interests: this.newEvent.interests
        },
        channels: ['events']
      }, session);

      this.addingEvent = false;
      this.newEvent = {
        name: '',
        location: '',
        date: '',
        time: '',
        teams: [],
        interests: []
      };
      confetti({ particleCount: 120, spread: 120, origin: { y: .8 } });   
    },
  },
})
  .use(GraffitiPlugin, {
    // graffiti: new GraffitiLocal(),
    graffiti: new GraffitiRemote(),
  })
  .mount("#app");

