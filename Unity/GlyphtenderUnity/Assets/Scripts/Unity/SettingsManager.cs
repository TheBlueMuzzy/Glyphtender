using UnityEngine;
using System;
using System.IO;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Serializable settings data for JSON persistence.
    /// </summary>
    [Serializable]
    public class GameSettingsData
    {
        // Main Menu Settings
        public int PlayMode = 1;              // 0=Local2P, 1=VsAI, 2=AIvsAI
        public int BluePersonalityIndex = 0;
        public int BlueDifficultyIndex = 0;
        public int YellowPersonalityIndex = 0;
        public int YellowDifficultyIndex = 0;
        public bool Allow2LetterWords = true; // Whether 2-letter words are allowed
        public int BoardSize = 1;             // 0=Small, 1=Medium, 2=Large

        // In-Game Menu Settings
        public int AISpeedIndex = 1;          // 0=Slow, 1=Normal, 2=Fast, 3=Instant
        public int InputMode = 1;             // 0=Tap, 1=Drag
        public int DragOffset = 2;            // 0, 1, or 2
    }

    /// <summary>
    /// Manages persistent game settings.
    /// Saves to JSON file in Application.persistentDataPath.
    /// </summary>
    public class SettingsManager : MonoBehaviour
    {
        public static SettingsManager Instance { get; private set; }

        private const string SETTINGS_FILENAME = "settings.json";
        private GameSettingsData _settings;
        private string _settingsPath;

        /// <summary>
        /// Event fired when any setting changes.
        /// </summary>
        public event Action OnSettingsChanged;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            _settingsPath = Path.Combine(Application.persistentDataPath, SETTINGS_FILENAME);
            Load();
        }

        /// <summary>
        /// Loads settings from disk, or creates defaults if none exist.
        /// </summary>
        private void Load()
        {
            if (File.Exists(_settingsPath))
            {
                try
                {
                    string json = File.ReadAllText(_settingsPath);
                    _settings = JsonUtility.FromJson<GameSettingsData>(json);
                    Debug.Log($"Settings loaded from {_settingsPath}");
                }
                catch (Exception e)
                {
                    Debug.LogWarning($"Failed to load settings: {e.Message}. Using defaults.");
                    _settings = new GameSettingsData();
                }
            }
            else
            {
                Debug.Log("No settings file found. Using defaults.");
                _settings = new GameSettingsData();
            }
        }

        /// <summary>
        /// Saves current settings to disk.
        /// </summary>
        public void Save()
        {
            try
            {
                string json = JsonUtility.ToJson(_settings, true);
                File.WriteAllText(_settingsPath, json);
                Debug.Log($"Settings saved to {_settingsPath}");
            }
            catch (Exception e)
            {
                Debug.LogError($"Failed to save settings: {e.Message}");
            }
        }

        // ========== Main Menu Settings ==========

        public PlayMode PlayMode
        {
            get => (PlayMode)_settings.PlayMode;
            set
            {
                if (_settings.PlayMode != (int)value)
                {
                    _settings.PlayMode = (int)value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public int BluePersonalityIndex
        {
            get => _settings.BluePersonalityIndex;
            set
            {
                if (_settings.BluePersonalityIndex != value)
                {
                    _settings.BluePersonalityIndex = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public int BlueDifficultyIndex
        {
            get => _settings.BlueDifficultyIndex;
            set
            {
                if (_settings.BlueDifficultyIndex != value)
                {
                    _settings.BlueDifficultyIndex = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public int YellowPersonalityIndex
        {
            get => _settings.YellowPersonalityIndex;
            set
            {
                if (_settings.YellowPersonalityIndex != value)
                {
                    _settings.YellowPersonalityIndex = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public int YellowDifficultyIndex
        {
            get => _settings.YellowDifficultyIndex;
            set
            {
                if (_settings.YellowDifficultyIndex != value)
                {
                    _settings.YellowDifficultyIndex = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public bool Allow2LetterWords
        {
            get => _settings.Allow2LetterWords;
            set
            {
                if (_settings.Allow2LetterWords != value)
                {
                    _settings.Allow2LetterWords = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public int BoardSizeIndex
        {
            get => _settings.BoardSize;
            set
            {
                if (_settings.BoardSize != value)
                {
                    _settings.BoardSize = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        // ========== In-Game Menu Settings ==========

        public int AISpeedIndex
        {
            get => _settings.AISpeedIndex;
            set
            {
                if (_settings.AISpeedIndex != value)
                {
                    _settings.AISpeedIndex = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public GameManager.InputMode InputMode
        {
            get => (GameManager.InputMode)_settings.InputMode;
            set
            {
                if (_settings.InputMode != (int)value)
                {
                    _settings.InputMode = (int)value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }

        public int DragOffset
        {
            get => _settings.DragOffset;
            set
            {
                if (_settings.DragOffset != value)
                {
                    _settings.DragOffset = value;
                    Save();
                    OnSettingsChanged?.Invoke();
                }
            }
        }
    }
}