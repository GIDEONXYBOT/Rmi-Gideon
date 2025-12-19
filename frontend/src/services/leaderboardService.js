import { getApiUrl } from '../utils/apiConfig.js';

/**
 * Service to fetch leaderboard data from external betting platform via backend proxy
 */
export class LeaderboardService {
  constructor() {
    this.apiUrl = getApiUrl();
  }

  /**
   * Decode HTML entities in a string
   * @param {string} text - Text containing HTML entities
   * @returns {string} Decoded text
   */
  decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Fetch leaderboard data from the external platform via backend proxy
   * @returns {Promise<Array>} Array of draw objects with betting data
   */
  async fetchLeaderboardData() {
    try {
      const response = await fetch(`${this.apiUrl}/api/external-betting/leaderboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch leaderboard data');
      }

      console.log(`✅ Fetched ${data.totalDraws} draws from leaderboard via backend proxy`);
      return data.data;

    } catch (error) {
      console.error('❌ Error fetching leaderboard data:', error);
      throw error;
    }
  }

  /**
   * Get the latest completed draw
   * @returns {Promise<Object|null>} Latest completed draw or null
   */
  async getLatestCompletedDraw() {
    const draws = await this.fetchLeaderboardData();
    return draws.find(draw => draw.status === 'completed') || null;
  }

  /**
   * Get current active draw (in progress)
   * @returns {Promise<Object|null>} Current active draw or null
   */
  async getCurrentDraw() {
    const draws = await this.fetchLeaderboardData();
    return draws.find(draw => draw.status === 'started') || null;
  }

  /**
   * Get betting statistics summary
   * @returns {Promise<Object>} Summary statistics
   */
  async getBettingStats() {
    const draws = await this.fetchLeaderboardData();

    const completedDraws = draws.filter(draw => draw.status === 'completed');
    const totalDraws = completedDraws.length;
    const totalBets = completedDraws.reduce((sum, draw) => sum + draw.totalBets, 0);
    const totalBetAmount = completedDraws.reduce((sum, draw) => sum + draw.totalBetAmount, 0);
    const totalWonAmount = completedDraws.reduce((sum, draw) => sum + draw.totalWonAmount, 0);

    return {
      totalDraws,
      totalBets,
      totalBetAmount,
      totalWonAmount,
      averageBetAmount: totalDraws > 0 ? totalBetAmount / totalDraws : 0,
      averageBetsPerDraw: totalDraws > 0 ? totalBets / totalDraws : 0
    };
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();