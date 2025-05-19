import { useEffect, useState } from 'react';
import CreatePollForm from './components/forms/CreatePolls';
import { Toaster } from 'react-hot-toast';
import PollListing from './components/modules/listing';
import "./utils/socket"
import { clearEventListener, listenToEvent } from './utils/socket';

function App() {
  const [activeTab, setActiveTab] = useState('polls');
  const [users, setUsers] = useState(0);


  useEffect(() => {
    listenToEvent("USER_LIST", (event) => updateUsers(event));
    return () => {
      clearEventListener("USER_LIST");
    };
  }, []);

  const updateUsers = async (pollEvent) => { 
    setUsers(pollEvent?.activeUsers || 0);
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-5xl mx-auto bg-white/80 rounded-2xl p-8">
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex justify-between space-x-4" aria-label="Tabs">
            <div>
              <button
                className={`px-5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors duration-200 ${activeTab === 'polls'
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-100'
                  }`}
                onClick={() => setActiveTab('polls')}
                aria-current={activeTab === 'polls' ? 'page' : undefined}
              >
                Polls
              </button>
              <button
                className={`px-5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors duration-200 ${activeTab === 'add'
                  ? 'border-blue-600 text-blue-700 bg-blue-50'
                  : 'border-transparent text-gray-500 hover:text-blue-600 hover:bg-blue-100'
                  }`}
                onClick={() => setActiveTab('add')}
                aria-current={activeTab === 'add' ? 'page' : undefined}
              >
                Add Poll
              </button>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a5 5 0 100 10 5 5 0 000-10zM2 18a8 8 0 0116 0H2z" clipRule="evenodd" />
                </svg>
                <span className="text-gray-700">{users}</span>
              </div>
            </div>
          </nav>

        </div>
        <div>
          {activeTab === 'polls' && (
            <div className="animate-fadeIn">
              <PollListing />
            </div>
          )}
          {activeTab === 'add' && (
            <div className="animate-fadeIn">
              <CreatePollForm />
            </div>
          )}
        </div>
      </div>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </div>
  );
}

export default App;
