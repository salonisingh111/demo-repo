// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ReputationRegistry
 * @dev Records star ratings (1-5) and reviews for freelancer addresses on-chain.
 */
contract ReputationRegistry {
    struct Rating {
        address client;
        uint8 score; // 1 to 5 stars
        string comment;
        uint256 timestamp;
    }

    // Maps freelancer address to array of ratings
    mapping(address => Rating[]) private ratings;
    
    // Maps freelancer to aggregate rating data
    mapping(address => uint256) public totalStars;
    mapping(address => uint256) public totalRatingsCount;

    event FreelancerRated(
        address indexed freelancer,
        address indexed client,
        uint8 score,
        string comment,
        uint256 timestamp
    );

    /**
     * @dev Submits a 1-5 star rating and comment for a freelancer.
     */
    function rateFreelancer(
        address _freelancer,
        uint8 _score,
        string calldata _comment
    ) external {
        require(_freelancer != address(0), "Invalid freelancer address");
        require(_score >= 1 && _score <= 5, "Score must be between 1 and 5");
        
        ratings[_freelancer].push(Rating({
            client: msg.sender,
            score: _score,
            comment: _comment,
            timestamp: block.timestamp
        }));

        totalStars[_freelancer] += _score;
        totalRatingsCount[_freelancer] += 1;

        emit FreelancerRated(_freelancer, msg.sender, _score, _comment, block.timestamp);
    }

    /**
     * @dev Returns the average rating (scaled by 10) and total rating count for a freelancer.
     * E.g. an average of 4.5 is returned as 45.
     */
    function getReputation(address _freelancer) external view returns (uint256 averageRating, uint256 ratingCount) {
        uint256 count = totalRatingsCount[_freelancer];
        if (count == 0) {
            return (0, 0);
        }
        averageRating = (totalStars[_freelancer] * 10) / count;
        return (averageRating, count);
    }

    /**
     * @dev Retrieves all ratings received by a freelancer.
     */
    function getRatings(address _freelancer) external view returns (Rating[] memory) {
        return ratings[_freelancer];
    }
}
