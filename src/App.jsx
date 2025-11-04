import React, { useState, useEffect } from 'react';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Gauge, Zap, AlertTriangle, MessageSquare, BookOpen, Film, Music, Mic, Heart, RefreshCw, User, Database } from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

let app, db, auth;

if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

const initializeFirebase = async (setUserId, setIsAuthReady) => {
    if (!firebaseConfig) {
        console.error("Firebase configuration is missing.");
        setIsAuthReady(true);
        return;
    }

    try {
        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        setUserId(auth.currentUser.uid);
    } catch (error) {
        console.error("Firebase Auth Error:", error);
        setUserId(crypto.randomUUID()); // Fallback to anonymous ID
    } finally {
        setIsAuthReady(true);
    }
};

// --- DATA STRUCTURES ---
// FIX: Storing component references (BookOpen, Film, etc.), not instantiated React elements (<BookOpen />)
const initialChoices = {
    books: { score: 0, icon: BookOpen },
    movies: { score: 0, icon: Film },
    music: { score: 0, icon: Music },
    podcasts: { score: 0, icon: Mic },
};

const getDefaultUser = (id) => ({
    id,
    lastActivity: Date.now(),
    choices: initialChoices,
    logs: [],
    profile: {
        name: 'Anonymous User',
    }
});

// --- UTILITIES ---

// FIX: Correct Firestore path creation for public data
const getPublicDataRef = (collectionName, docId) => {
    if (!db) return null;
    // Path structure: artifacts/appId/public/data/collectionName/docId (even number of segments)
    return doc(db, 'artifacts', appId, 'public', 'data', collectionName, docId);
};

// Function to safely save data
const saveUserChoices = async (userId, data, setSaveStatus) => {
    if (!db || !userId) {
        setSaveStatus("Error: Database not initialized.");
        return;
    }
    const userRef = getPublicDataRef('mediaChoices', userId);
    if (!userRef) return;

    try {
        await setDoc(userRef, data, { merge: true });
        setSaveStatus("Saved!");
    } catch (e) {
        console.error("Error saving document: ", e);
        setSaveStatus("Error saving data.");
    }
    setTimeout(() => setSaveStatus(""), 2000);
};

// --- REACT COMPONENTS ---

const Header = ({ userId, choices, isAuthReady }) => {
    const totalScore = Object.values(choices).reduce((sum, choice) => sum + choice.score, 0);

    return (
        <header className="p-4 bg-white border-b border-indigo-100 shadow-md sticky top-0 z-10">
            <div className="flex justify-between items-center max-w-5xl mx-auto">
                <div className="flex items-center space-x-3">
                    <Zap className="w-6 h-6 text-indigo-600" />
                    <h1 className="text-xl font-bold text-gray-800 tracking-tight">
                        Smart Media Choices
                    </h1>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="hidden sm:flex items-center text-sm font-medium text-gray-600">
                        <Gauge className="w-4 h-4 mr-1 text-indigo-500" />
                        Total Affinity: <span className="ml-1 font-bold text-indigo-700">{totalScore}</span>
                    </div>
                    {isAuthReady && (
                        <div className="text-xs flex items-center bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
                            <User className="w-3 h-3 mr-1 text-indigo-500" />
                            <span className="font-mono text-indigo-700 truncate max-w-[100px] sm:max-w-none">{userId || 'Loading...'}</span>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

const ChoiceCard = ({ media, data, onAdjust }) => {
    // Destructure and use IconComponent to render the component reference
    const { score, icon: IconComponent } = data;
    const colorClass = score > 15 ? 'bg-green-100 text-green-800 border-green-300' :
                       score > 5 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                       'bg-gray-100 text-gray-800 border-gray-300';

    return (
        <div className={`p-5 rounded-xl shadow-lg transition-all transform hover:shadow-xl hover:-translate-y-0.5 border-2 ${colorClass}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {/* Render the icon component */}
                    <IconComponent className="w-5 h-5" />
                    <h2 className="text-lg font-semibold capitalize">{media}</h2>
                </div>
                <div className="text-2xl font-extrabold flex items-center">
                    <span className="text-sm font-medium mr-1">Score:</span>
                    {score}
                </div>
            </div>
            <div className="mt-4 flex space-x-3">
                <button
                    onClick={() => onAdjust(media, 5)}
                    className="flex-1 p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg shadow-md transition duration-150 text-sm font-medium"
                >
                    +5 (Love It)
                </button>
                <button
                    onClick={() => onAdjust(media, 1)}
                    className="flex-1 p-2 bg-indigo-200 hover:bg-indigo-300 text-indigo-800 rounded-lg shadow-md transition duration-150 text-sm font-medium"
                >
                    +1
                </button>
                <button
                    onClick={() => onAdjust(media, -1)}
                    className="flex-1 p-2 bg-red-200 hover:bg-red-300 text-red-800 rounded-lg shadow-md transition duration-150 text-sm font-medium"
                >
                    -1
                </button>
            </div>
        </div>
    );
};

const ActivityLog = ({ logs }) => {
    return (
        <div className="mt-8 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 flex items-center text-gray-700">
                <MessageSquare className="w-5 h-5 mr-2 text-indigo-500" />
                Activity Log
            </h2>
            <div className="max-h-60 overflow-y-auto space-y-2">
                {logs.length === 0 && (
                    <p className="text-gray-500 italic">No activity yet. Start scoring your media!</p>
                )}
                {logs.slice().reverse().map((log, index) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                        <span className="text-gray-700">{log.message}</span>
                        <span className="text-xs text-gray-400">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Instructions = () => (
    <div className="p-6 mt-8 bg-indigo-50 rounded-xl shadow-inner border border-indigo-200">
        <h2 className="text-xl font-bold mb-3 flex items-center text-indigo-800">
            <Heart className="w-5 h-5 mr-2" />
            How to Use Smart Media Choices
        </h2>
        <ul className="list-disc list-inside space-y-2 text-indigo-700 text-sm">
            <li>**+5 (Love It):** Use for media that genuinely excites you and brings you joy.</li>
            <li>**+1:** Use for media you simply enjoyed or found informative.</li>
            <li>**-1:** Use for media you disliked or regret spending time on.</li>
            <li>Your total scores automatically **save to the cloud (Firebase)** so you can track your media preferences across devices!</li>
        </ul>
    </div>
);

// --- MAIN APP COMPONENT ---

export default function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userData, setUserData] = useState(getDefaultUser(null));
    const [saveStatus, setSaveStatus] = useState("");

    // 1. Initialize Firebase and Auth
    useEffect(() => {
        if (!isAuthReady) {
            initializeFirebase(setUserId, setIsAuthReady);
        }
    }, [isAuthReady]);

    // 2. Load/Listen to Data
    useEffect(() => {
        if (!db || !userId) return;

        const userRef = getPublicDataRef('mediaChoices', userId);

        // Fetch initial data or listen for real-time updates
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const fetchedData = docSnap.data();
                setUserData(prev => ({
                    ...prev,
                    ...fetchedData,
                    // Ensure all keys exist and icons are the component references for local state
                    choices: { 
                        ...initialChoices, 
                        ...fetchedData.choices,
                        books: { ...fetchedData.choices.books, icon: BookOpen },
                        movies: { ...fetchedData.choices.movies, icon: Film },
                        music: { ...fetchedData.choices.music, icon: Music },
                        podcasts: { ...fetchedData.choices.podcasts, icon: Mic },
                    }, 
                    logs: fetchedData.logs || [],
                }));
            } else {
                // If document doesn't exist, save the default structure
                saveUserChoices(userId, getDefaultUser(userId), setSaveStatus);
                setUserData(getDefaultUser(userId));
            }
        }, (error) => {
            console.error("Firestore Listener Error:", error);
            setSaveStatus("Error listening to database.");
        });

        // Cleanup function
        return () => unsubscribe();
    }, [userId]);


    // 3. User interaction logic
    const handleAdjustScore = (media, adjustment) => {
        if (!userId) {
            setSaveStatus("Please wait for user authentication.");
            return;
        }
        
        // Preserve the icon component reference for the local state update
        const currentIcon = userData.choices[media].icon;

        const updatedChoices = {
            ...userData.choices,
            [media]: {
                score: Math.max(0, userData.choices[media].score + adjustment), // Prevent negative scores
                icon: currentIcon // Keep the icon component reference
            }
        };

        const logMessage = `${adjustment > 0 ? '+' : ''}${adjustment} ${media}`;
        const updatedLogs = [...userData.logs, { message: logMessage, timestamp: Date.now() }];

        const updatedData = {
            ...userData,
            lastActivity: Date.now(),
            choices: updatedChoices,
            logs: updatedLogs.slice(-10) // Keep only the last 10 logs
        };

        setUserData(updatedData); // Optimistic update
        
        // IMPORTANT: Strip the React component references before saving to Firestore
        // Firestore cannot save React components (functions).
        const dataToSave = {
            ...updatedData,
            choices: Object.fromEntries(
                Object.entries(updatedChoices).map(([key, value]) => [
                    key, 
                    { score: value.score } // Only save the score, not the icon component
                ])
            )
        };
        saveUserChoices(userId, dataToSave, setSaveStatus); // Save to Firestore
    };

    const handleReset = () => {
        if (!userId) return;

        const resetData = {
            ...getDefaultUser(userId),
            id: userId,
            lastActivity: Date.now(),
        };

        setUserData(resetData);
        // Strip icons for saving
        const dataToSave = {
            ...resetData,
            choices: Object.fromEntries(
                Object.entries(resetData.choices).map(([key, value]) => [
                    key, 
                    { score: value.score }
                ])
            )
        };
        saveUserChoices(userId, dataToSave, setSaveStatus);
    };

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="flex items-center text-lg text-gray-600">
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin text-indigo-500" />
                    Connecting to the cloud...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            <Header userId={userId} choices={userData.choices} isAuthReady={isAuthReady} />

            <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-20">
                <Instructions />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    {Object.entries(userData.choices).map(([media, data]) => (
                        <ChoiceCard
                            key={media}
                            media={media}
                            data={data}
                            onAdjust={handleAdjustScore}
                        />
                    ))}
                </div>

                <div className="mt-8 flex justify-between items-center p-3 bg-white rounded-xl shadow-md border border-gray-100">
                    <button
                        onClick={handleReset}
                        className="flex items-center px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md transition duration-150 text-sm font-medium"
                    >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Reset All Scores
                    </button>
                    <div className="text-sm font-medium flex items-center text-gray-600">
                        <Database className="w-4 h-4 mr-1 text-green-500" />
                        Save Status:
                        <span className="ml-1 text-indigo-700 font-bold">{saveStatus || 'Synced'}</span>
                    </div>
                </div>

                <ActivityLog logs={userData.logs} />

            </main>
        </div>
    );
}
