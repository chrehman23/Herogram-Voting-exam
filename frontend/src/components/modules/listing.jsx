import React, { useEffect, useState } from "react";
import AppApi from "../../api/app.api";
import VoteCard from "../cards/VotCard";
import { clearEventListener, listenToEvent } from "../../utils/socket";

const PollListing = () => {
   const [polls, setPolls] = useState([]);
   const [loading, setLoading] = useState(true);

   useEffect(() => {
      fetchPolls();
   }, []);

   useEffect(() => {
      listenToEvent("POLL_REGISTER", (pollEvent) => updatePoll(pollEvent));
      return () => {
         clearEventListener("POLL_REGISTER");
      };
   }, []);

   const updatePoll = async (pollEvent) => {
      setPolls(prev => [pollEvent, ...prev]);
   };

   const fetchPolls = async () => {
      setLoading(true);
      const data = await AppApi.getPollsList();
      setPolls(data || []);
      setLoading(false);
   };


   if (loading) {
      return (
         <div className="flex justify-center items-center py-10" style={{ minHeight: "700vh" }}>
            <div className="text-blue-600 font-semibold">Loading polls...</div>
         </div>
      );
   }

   if (!polls.length) {
      return (
         <div className="flex justify-center items-center py-10">
            <div className="text-gray-500">No polls found.</div>
         </div>
      );
   }

   return (
      <div className="w-full px-2 py-8">
         <div className="flex flex-col gap-5 w-full">
            {polls.map((poll, idx) => (
               <div key={poll.id || idx}>
                  <VoteCard
                     data={poll}
                     id={poll?.id}
                  />
               </div>
            ))}
         </div>
      </div>
   );
};

export default PollListing;
