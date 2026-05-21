// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title EscrowManager
 * @dev Upgraded gasless milestone-based freelance escrow contract on Base Sepolia.
 */
contract EscrowManager {
    enum MilestoneStatus { Pending, Funded, Delivered, Released, Cancelled, Disputed }

    struct Milestone {
        uint256 id;
        string title;
        uint256 amount;
        MilestoneStatus status;
        string deliveryNotes;
        uint256 deliveryTime;
    }

    struct Escrow {
        uint256 id;
        address client;
        address freelancer;
        uint256 deadline;
        string title;
        string description;
        uint256 milestoneCount;
    }

    IERC20 public immutable paymentToken;
    uint256 public escrowCounter;
    mapping(uint256 => Escrow) public escrows;
    
    // Maps escrow ID => milestone ID => Milestone details
    mapping(uint256 => mapping(uint256 => Milestone)) public escrowMilestones;

    event EscrowCreated(
        uint256 indexed id, 
        address indexed client, 
        address indexed freelancer, 
        uint256 totalAmount, 
        uint256 milestoneCount
    );
    event MilestoneFunded(uint256 indexed escrowId, uint256 indexed milestoneId);
    event MilestoneDelivered(uint256 indexed escrowId, uint256 indexed milestoneId, string deliveryNotes);
    event MilestoneReleased(uint256 indexed escrowId, uint256 indexed milestoneId);
    event MilestoneCancelled(uint256 indexed escrowId, uint256 indexed milestoneId);
    event MilestoneDisputed(uint256 indexed escrowId, uint256 indexed milestoneId);
    event MilestoneAutoReleased(uint256 indexed escrowId, uint256 indexed milestoneId);

    constructor(address _paymentToken) {
        require(_paymentToken != address(0), "Invalid token address");
        paymentToken = IERC20(_paymentToken);
    }

    /**
     * @dev Creates an escrow split into multiple milestones.
     */
    function createEscrow(
        address _freelancer,
        uint256 _deadline,
        string calldata _title,
        string calldata _description,
        string[] calldata _milestoneTitles,
        uint256[] calldata _milestoneAmounts
    ) external returns (uint256) {
        require(_freelancer != address(0), "Invalid freelancer address");
        require(_milestoneTitles.length > 0, "At least one milestone required");
        require(_milestoneTitles.length == _milestoneAmounts.length, "Mismatched milestone parameters");
        require(_deadline > block.timestamp, "Deadline must be in the future");

        escrowCounter++;
        uint256 totalAmount = 0;

        escrows[escrowCounter] = Escrow({
            id: escrowCounter,
            client: msg.sender,
            freelancer: _freelancer,
            deadline: _deadline,
            title: _title,
            description: _description,
            milestoneCount: _milestoneTitles.length
        });

        for (uint256 i = 0; i < _milestoneTitles.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be positive");
            escrowMilestones[escrowCounter][i] = Milestone({
                id: i,
                title: _milestoneTitles[i],
                amount: _milestoneAmounts[i],
                status: MilestoneStatus.Pending,
                deliveryNotes: "",
                deliveryTime: 0
            });
            totalAmount += _milestoneAmounts[i];
        }

        emit EscrowCreated(escrowCounter, msg.sender, _freelancer, totalAmount, _milestoneTitles.length);
        return escrowCounter;
    }

    /**
     * @dev Client funds a specific milestone, transferring MockUSD tokens into escrow.
     */
    function fundMilestone(uint256 _escrowId, uint256 _milestoneId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.id == _escrowId, "Escrow does not exist");
        require(msg.sender == escrow.client, "Only client can fund");

        Milestone storage milestone = escrowMilestones[_escrowId][_milestoneId];
        require(milestone.status == MilestoneStatus.Pending, "Milestone must be Pending");

        milestone.status = MilestoneStatus.Funded;
        require(
            paymentToken.transferFrom(msg.sender, address(this), milestone.amount),
            "Token transfer failed"
        );

        emit MilestoneFunded(_escrowId, _milestoneId);
    }

    /**
     * @dev Freelancer marks a funded milestone as delivered, logging deliverables.
     */
    function markMilestoneDelivered(
        uint256 _escrowId,
        uint256 _milestoneId,
        string calldata _deliveryNotes
    ) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.id == _escrowId, "Escrow does not exist");
        require(msg.sender == escrow.freelancer, "Only freelancer can mark delivered");

        Milestone storage milestone = escrowMilestones[_escrowId][_milestoneId];
        require(milestone.status == MilestoneStatus.Funded, "Milestone must be Funded");

        milestone.status = MilestoneStatus.Delivered;
        milestone.deliveryNotes = _deliveryNotes;
        milestone.deliveryTime = block.timestamp;

        emit MilestoneDelivered(_escrowId, _milestoneId, _deliveryNotes);
    }

    /**
     * @dev Client releases locked funds of a milestone to the freelancer.
     */
    function releaseMilestone(uint256 _escrowId, uint256 _milestoneId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.id == _escrowId, "Escrow does not exist");
        require(msg.sender == escrow.client, "Only client can release funds");

        Milestone storage milestone = escrowMilestones[_escrowId][_milestoneId];
        require(
            milestone.status == MilestoneStatus.Funded || 
            milestone.status == MilestoneStatus.Delivered ||
            milestone.status == MilestoneStatus.Disputed,
            "Milestone must be Funded, Delivered, or Disputed"
        );

        milestone.status = MilestoneStatus.Released;
        require(
            paymentToken.transfer(escrow.freelancer, milestone.amount),
            "Token release transfer failed"
        );

        emit MilestoneReleased(_escrowId, _milestoneId);
    }

    /**
     * @dev Freelancer raises a dispute if the client is silent after delivery.
     */
    function disputeMilestone(uint256 _escrowId, uint256 _milestoneId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.id == _escrowId, "Escrow does not exist");
        require(msg.sender == escrow.freelancer, "Only freelancer can raise dispute");

        Milestone storage milestone = escrowMilestones[_escrowId][_milestoneId];
        require(milestone.status == MilestoneStatus.Delivered, "Milestone must be Delivered to dispute");

        milestone.status = MilestoneStatus.Disputed;

        emit MilestoneDisputed(_escrowId, _milestoneId);
    }

    /**
     * @dev Client or freelancer triggers 48-hour auto-release of delivered funds.
     */
    function autoReleaseMilestone(uint256 _escrowId, uint256 _milestoneId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.id == _escrowId, "Escrow does not exist");

        Milestone storage milestone = escrowMilestones[_escrowId][_milestoneId];
        require(milestone.status == MilestoneStatus.Delivered, "Milestone must be Delivered");
        require(block.timestamp >= milestone.deliveryTime + 48 hours, "48-hour auto-release period not met");

        milestone.status = MilestoneStatus.Released;
        require(
            paymentToken.transfer(escrow.freelancer, milestone.amount),
            "Token auto-release transfer failed"
        );

        emit MilestoneAutoReleased(_escrowId, _milestoneId);
    }

    /**
     * @dev Client cancels a milestone. 
     * Can cancel if still Pending. If Funded, only if the overall project deadline has expired.
     */
    function cancelMilestone(uint256 _escrowId, uint256 _milestoneId) external {
        Escrow storage escrow = escrows[_escrowId];
        require(escrow.id == _escrowId, "Escrow does not exist");
        require(msg.sender == escrow.client, "Only client can cancel");

        Milestone storage milestone = escrowMilestones[_escrowId][_milestoneId];
        MilestoneStatus prevStatus = milestone.status;

        require(
            prevStatus == MilestoneStatus.Pending ||
            (prevStatus == MilestoneStatus.Funded && block.timestamp > escrow.deadline),
            "Cannot cancel milestone at this stage"
        );

        milestone.status = MilestoneStatus.Cancelled;

        if (prevStatus == MilestoneStatus.Funded) {
            require(
                paymentToken.transfer(escrow.client, milestone.amount),
                "Refund transfer failed"
            );
        }

        emit MilestoneCancelled(_escrowId, _milestoneId);
    }

    /**
     * @dev Helper to retrieve all milestones for an escrow.
     */
    function getMilestones(uint256 _escrowId) external view returns (Milestone[] memory) {
        uint256 count = escrows[_escrowId].milestoneCount;
        Milestone[] memory milestonesList = new Milestone[](count);
        for (uint256 i = 0; i < count; i++) {
            milestonesList[i] = escrowMilestones[_escrowId][i];
        }
        return milestonesList;
    }
}
