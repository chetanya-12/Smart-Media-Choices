import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
// FIX: Using direct imports for firestore and auth to prevent build errors
import { getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// The global variables are injected by the environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Lucide icons for aesthetics
import { Film, BookOpen, Clock, Users, Send } from 'lucide-react';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/95 backdrop-blur-sm p-6 rounded-xl shadow-2xl ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 ease-in-out
      ${disabled
        ? 'bg-gray-400 cursor-not-allowed text-gray-700'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] shadow-lg shadow-indigo-500/50'
      }`}
  >
    {children}
  </button>
);

// --- MAIN APP COMPONENT ---
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) return;

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);
      setDb(firestore);
      setAuth(authentication);

      // Listen for auth state changes
      const unsubscribe = onAuthStateChanged(authentication, (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // If the user logs out or session expires, try to sign in anonymously
          console.log("User not found, attempting anonymous sign-in.");
          if (authentication && !user) {
            signInAnonymously(authentication).catch(error => {
              console.error("Anonymous sign-in failed:", error);
            });
          }
        }
        setIsAuthReady(true);
      });

      // Handle custom token sign-in once auth is ready
      if (initialAuthToken) {
        signInWithCustomToken(authentication, initialAuthToken).catch(error => {
          console.error("Custom token sign-in failed:", error);
        });
      } else {
        // If no token, proceed to anonymous sign-in check via onAuthStateChanged
        if (!authentication.currentUser) {
            signInAnonymously(authentication).catch(error => {
                console.error("Initial anonymous sign-in failed:", error);
            });
        }
      }

      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
    }
  }, []);

  // 2. Real-time Data Listener
  useEffect(() => {
    if (!db || !isAuthReady) return;

    // Use a public collection path for shared data
    const collectionPath = `/artifacts/${appId}/public/data/mediaChoices`;
    const q = query(collection(db, collectionPath));

    // Listen for real-time updates
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Handle serialization for complex objects if needed, though this data is simple
        items.push({ id: doc.id, ...data });
      });

      // Sort by timestamp descending
      items.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setMediaItems(items);
      console.log("Media items updated:", items.length);
    }, (error) => {
      console.error("Firestore snapshot error:", error);
    });

    return () => unsubscribe();
  }, [db, isAuthReady]); // Re-run when DB is ready or auth state changes

  // 3. Data Submission Handler
  const handleSubmit = async () => {
    if (!db || !userId || message.trim() === '') return;

    setIsLoading(true);
    try {
      const collectionPath = `/artifacts/${appId}/public/data/mediaChoices`;
      
      await addDoc(collection(db, collectionPath), {
        text: message.trim(),
        userId: userId, // Record the user who submitted the choice
        timestamp: serverTimestamp(),
      });

      setMessage('');
      console.log("Document successfully written!");
    } catch (e) {
      console.error("Error adding document: ", e);
    } finally {
      setIsLoading(false);
    }
  };

  const isSubmitDisabled = !isAuthReady || isLoading || message.trim() === '';

  // Utility function for rendering icons based on text content
  const getIcon = (text) => {
    if (text.toLowerCase().includes('movie') || text.toLowerCase().includes('film')) return <Film className="w-5 h-5 text-indigo-500 mr-2" />;
    if (text.toLowerCase().includes('book') || text.toLowerCase().includes('read')) return <BookOpen className="w-5 h-5 text-indigo-500 mr-2" />;
    return <Users className="w-5 h-5 text-indigo-500 mr-2" />;
  };

  // 4. Render UI
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-inter">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2 text-center">
          Smart Media Choices
        </h1>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Collaborative feed for our group's next movie, book, or show.
          <br/>
          <span className="font-mono text-xs text-gray-500">
            User ID: {isAuthReady ? (userId || 'Loading...') : 'Connecting...'}
          </span>
        </p>

        {/* Input Card */}
        <Card className="mb-8">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Suggest a title (e.g., 'Watch Dune: Part Two' or 'Read The Midnight Library')"
            rows="3"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors mb-4"
            disabled={!isAuthReady || isLoading}
          />
          <Button onClick={handleSubmit} disabled={isSubmitDisabled}>
            {isLoading ? 'Submitting...' : 'Post Suggestion'}
          </Button>
        </Card>

        {/* Feed Card */}
        <Card>
          <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4 flex items-center">
            <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
            Active Suggestions ({mediaItems.length})
          </h2>

          {mediaItems.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              {isAuthReady ? 'No suggestions yet. Post the first one!' : 'Connecting to database...'}
            </div>
          )}

          <div className="space-y-4">
            {mediaItems.map((item) => (
              <div key={item.id} className="border-b last:border-b-0 pb-3">
                <p className="flex items-start text-gray-800 font-medium mb-1">
                  {getIcon(item.text)}
                  {item.text}
                </p>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span className="font-mono truncate max-w-[150px] sm:max-w-none">
                    Submitted by: {item.userId}
                  </span>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleString() : 'Just now'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default App;
