/*******************************************************************************
 * UIBootstrap.cs
 *
 * PURPOSE:
 *   Ensures all UI singletons exist at startup.
 *   Creates TurnIndicator and any other required UI components.
 *
 * RESPONSIBILITIES:
 *   - Create UI manager GameObjects if they don't exist
 *   - Run early via RuntimeInitializeOnLoadMethod (after scene load)
 *
 * ARCHITECTURE:
 *   - Static bootstrapper, no instance needed
 *   - Creates singletons that parent to UICamera
 *
 * USAGE:
 *   Automatic - runs after scene load
 ******************************************************************************/

using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Bootstraps UI singletons after scene load.
    /// </summary>
    public static class UIBootstrap
    {
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Initialize()
        {
            // Create TurnIndicator if it doesn't exist
            if (TurnIndicator.Instance == null)
            {
                var turnIndicatorObj = new GameObject("TurnIndicator");
                turnIndicatorObj.AddComponent<TurnIndicator>();
                Debug.Log("[UIBootstrap] TurnIndicator created");
            }
        }
    }
}
