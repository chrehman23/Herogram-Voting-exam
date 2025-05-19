import React, { useEffect, useState, useRef } from "react";
import Countdown from 'react-countdown';
import moment from 'moment';
import AppApi from "../../api/app.api";
import { clearEventListener, listenToEvent } from "../../utils/socket";
import toast from "react-hot-toast";
import Cookies from "js-cookie"

const renderer = ({ hours, minutes, seconds, completed }) => {
  if (completed) {
    return "Time over";
  } else {
    return (
      <div className="flex items-center gap-1">
        <div className="flex flex-col items-center">
          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs min-w-[32px] text-center">{String(hours).padStart(2, '0')}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">Hrs</span>
        </div>
        <span className="text-gray-400 font-bold px-1">:</span>
        <div className="flex flex-col items-center">
          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs min-w-[32px] text-center">{String(minutes).padStart(2, '0')}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">Min</span>
        </div>
        <span className="text-gray-400 font-bold px-1">:</span>
        <div className="flex flex-col items-center">
          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-xs min-w-[32px] text-center">{String(seconds).padStart(2, '0')}</span>
          <span className="text-[10px] text-gray-500 mt-0.5">Sec</span>
        </div>
      </div>
    );
  }
};

const VoteCard = ({
  id,
  data: poll
}) => {
  const [data, setData] = useState(poll);
  const [isDisabled, setIsDisabled] = useState(false);
  const stateRef = useRef(data);

  useEffect(() => {
    stateRef.current = data;
  }, [data]);

  useEffect(() => {
    listenToEvent("VOTED", (pollEvent) => handleVoteEvent(pollEvent));
    return () => {
      clearEventListener("VOTED");
    };
  }, [id]);

  const handleVoteEvent = (pollEvent) => {
    if (pollEvent?.id == id) {
      const userId = Cookies.get("userId"); 
      pollEvent.votedIndex = pollEvent?.userId == userId ? pollEvent.votedIndex : stateRef?.current?.votedIndex;
      setData(pollEvent);
      if (pollEvent?.userId !== userId) {
        toast.success(`New user voted on '${pollEvent?.question}'`);
      }
    }
  };


  const voteOnPoll = async (id, optionIdx) => {
    try {
      const response = await AppApi.voteOnPoll(id, { optionIdx });
      console.log(response);
    } catch (error) {
      console.log(error?.message);
    }
  }

  const totalVotes = data?.votes && data?.votes.length ? data?.votes.reduce((sum, v) => sum + v, 0) : 0;

  return (
    <div className="w-full bg-white border border-gray-200 rounded-xl transition-all duration-150 p-0 mb-3">
      <div className="flex flex-col sm:flex-row items-stretch w-full">
        <div className="flex-1 flex flex-col justify-between p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
            <h2
              className="text-lg font-semibold text-gray-800 mb-1 sm:mb-0 truncate"
              title={data?.question}
            >
              {data?.question}
            </h2>
            {data?.createdAt && (
              <span className="text-xs text-gray-400">
                Created At: {moment(data?.createdAt).fromNow()}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-2 mb-2">
            {data?.options.map((opt, idx) => {
              const isSelected = data?.votedIndex == idx;
              const voteCount = data?.votes[idx] || 0;
              const percent = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
              return (
                <li key={idx} className="w-full">
                  <button
                    type="button"
                    className={`w-full flex items-center justify-between px-4 py-2 rounded border transition
                      ${isDisabled ? "opacity-60 cursor-not-allowed" : ""}
                    `}
                    style={{
                      background: `linear-gradient(90deg, #dbeafe ${percent}%, #fff ${percent}%)`,
                    }}
                    onClick={() => {
                      if (!isDisabled) {
                        voteOnPoll(id, idx);
                      }
                    }}
                    disabled={isDisabled}
                  >
                    <span className="font-medium text-left">{opt}</span>
                    <span className="ml-4 text-xs font-semibold flex items-center gap-2">
                      <span>
                        {isSelected && (
                          <>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="inline-block w-4 h-4 text-green-500"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </>
                        )}
                      </span>
                      <span>
                        {voteCount} vote{voteCount !== 1 ? "s" : ""}
                      </span>

                      <span className="text-gray-400">
                        ({percent}%)
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-gray-500">
              {isDisabled
                ? "Voting disabled"
                : "Select an option to vote"}
            </span>
            <div>
              <Countdown
                onComplete={() => {
                  setIsDisabled(true)
                }}
                date={data?.expiresAt}
                renderer={renderer}
              />
            </div>
            <span className="text-xs text-gray-400">
              Total votes: {totalVotes}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoteCard;
