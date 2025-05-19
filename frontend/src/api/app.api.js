import axios from "../utils/axios";
import toast from 'react-hot-toast';
import Cookies from "js-cookie"
let AppApi = {
   autoLoginOnPageReload: async () => {
      try {
         const oldToken = Cookies.get("token");
         if (oldToken) return oldToken;
         const response = await axios({
            url: '/api/v1/auth/login',
            method: 'get',
         })
         const token = response?.data?.token
         const userId = response?.data?.userId
         if (token) {
            Cookies.set("token", token);
            Cookies.set("userId", userId);
            toast.success("You are connect with this application successfully.")
         }
         return token
      } catch (error) {
         console.log(error?.message);
      }
   },
   getPollsList: async () => {
      try {
         const token = await AppApi.autoLoginOnPageReload()
         const response = await axios({
            url: '/api/v1/polls',
            method: 'get',
            headers: {
               Authorization: "Bearer " + token,
            },
         })
         const polls = response?.data?.polls
         if (polls) {
            return polls
         }
         return null
      } catch (error) {
         console.log(error?.message);
         return null
      }
   },
   createPoll: async (data) => {
      try {
         const response = await axios({
            url: '/api/v1/poll',
            data,
            method: 'post',
            headers: {
               Authorization: "Bearer " + Cookies.get("token"),
            },
         })
         const poll = response?.data?.id
         if (poll) {
            toast.success("Poll created successfully!");
         } else {
            toast.error("Failed to create poll.");
         }
      } catch (error) {
         toast.error("Failed to create poll.");
         console.log(error?.message);
      }
   },
   voteOnPoll: async (id, data) => {
      try {
         const response = await axios({
            url: `/api/v1/poll/${id}/vote`,
            data,
            method: 'post',
            headers: {
               Authorization: "Bearer " + Cookies.get("token"),
            },
         })
         const poll = response?.data
         toast.success(poll?.message);
         return poll;
      } catch (error) {
         toast.error(error?.response?.data?.error || "Failed to submit vote.");
         return null;
      }
   },

}

export default AppApi
