<template>
  <div v-html="htmlFromServer"></div>
</template>

<script>
import axios from 'axios';

export default {
  data() {
    return { htmlFromServer: '' };
  },
  async mounted() {
    const r = await axios.get('http://api.ejemplo.com/data');
    this.htmlFromServer = r.data.html;
    localStorage.setItem('authToken', r.data.token);
    window.postMessage({ token: r.data.token }, '*');
  },
};
</script>
