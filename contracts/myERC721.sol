//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ERC721URIStorage {

  mapping(uint => string) private _tokenURIs;

  function _getTokenURI(uint _tokenId) view internal returns (string memory) {
    return string(abi.encodePacked(_tokenURIs[_tokenId]));
  }

  function _setTokenURI(uint _tokenId, string memory _tokenURI) internal {
    _tokenURIs[_tokenId] = _tokenURI;
  }

}

contract MyAccessControll{

    bytes32 mainAdmin;

    struct RoleData{
        mapping (address => bool) members;
        bytes32 adminRole;
    }

    mapping (bytes32 => RoleData) _roles;

    modifier onlyAdmin(bytes32 _role, address _admin){
        require(isAdmin(_role,_admin), "Error: You have no access to this function!");
        _;
    }

    event RoleCreated(bytes32 _role, bytes32 _adminRole);
    event RoleGranded(bytes32 indexed _role, address indexed _account, address _sender);
    event RoleRevoked(bytes32 indexed _role, address indexed _account, address _sender);
    event AdminRoleChanged(bytes32 indexed _prevAdminRole, bytes32 indexed _newAdminRole, bytes32 _role);

    constructor (bytes32 _adminRole) {
        RoleData storage _roleData = _roles[_adminRole];
        _roleData.members[msg.sender] = true;
        _roleData.adminRole = _adminRole;
        mainAdmin = _adminRole;
        emit RoleCreated(_adminRole, _adminRole);
        emit RoleGranded(_adminRole, msg.sender, msg.sender);
    }

    function _grandRole(bytes32 _role, address _account) internal {
        _roles[_role].members[_account] = true;
        emit RoleGranded(_role, _account, msg.sender);
    }

    function _removeRoleFrom(bytes32 _role, address _account) internal {
       _roles[_role].members[_account] = false;
       emit RoleRevoked(_role, _account, msg.sender);
    }

    function checkRole(bytes32 _role, address _account) public view returns(bool){
        return _roles[_role].members[_account];
    }

    function isAdmin(bytes32 _role, address _account) public view returns(bool){
        if(_roles[mainAdmin].members[_account]){return true;}
        RoleData storage adminRole = _roles[_roles[_role].adminRole];
        return adminRole.members[_account];
    }

    function changeAdminRole(bytes32 _role, bytes32 _newAdminRole) public onlyAdmin(_role,msg.sender) {
        bytes32 _prevAdminRole = _roles[_role].adminRole;
        _roles[_role].adminRole = _newAdminRole;
        emit AdminRoleChanged(_prevAdminRole, _newAdminRole, _role);
    }

    function grandRole(bytes32 _role, address _account) public onlyAdmin(_role, msg.sender) {
        if(!checkRole(_role, _account)){
            _grandRole(_role, _account);
        }
    }

    function revokeRole(bytes32 _role, address _account) public onlyAdmin(_role, msg.sender) {
        if(checkRole(_role, _account)){
           _removeRoleFrom(_role, _account);
        }
    }

    function createNewRole(bytes32 _role, bytes32 _adminRole) public onlyAdmin(_role, msg.sender) {
        _createNewRole(_role, _adminRole);
        emit RoleCreated(_role, _adminRole);
    }

    function _createNewRole(bytes32 _role, bytes32 _adminRole) internal {
        RoleData storage roleData = _roles[_role];
        roleData.adminRole = _adminRole;
    }
}

contract MyERC721 is MyAccessControll, ERC721URIStorage{

  string public name;
  string public symbol;

  constructor(string memory _name, string memory _symbol, bytes32 _adminRole) MyAccessControll(_adminRole) ERC721URIStorage(){
    name = _name;
    symbol = _symbol;
    bytes32 minter = keccak256("minter");
    bytes32 burner = keccak256("burner");
    createNewRole(minter, _adminRole);
    grandRole(minter, msg.sender);
    createNewRole(burner, _adminRole);
    grandRole(burner, msg.sender);
  }

  function getName()view public returns (string memory) {
    return name;
  }

  function _mint(address _to, uint _tokenId, string memory _tokenURI) internal {
    require(!_exist(_tokenId), "Error: Token with this id is already exists!");
    require(address(0) != _to, "Error: Mint to zero address!");
    balances[_to]++;
    owners[_tokenId] = _to;
    _setTokenURI(_tokenId, _tokenURI);
    emit Transfer(address(0), _to, _tokenId);
  }

  function mint(address _to, uint _tokenId, string memory _tokenURI) public OnlyMinter(msg.sender) {
    _mint(_to, _tokenId, _tokenURI);
  }

  modifier OnlyMinter(address _sender){
    require(checkRole(keccak256("minter"), _sender), "Error: You have no access to mint tokens!");
    _;
  }

  modifier OnlyBurner(address _sender){
    require(checkRole(keccak256("burner"), _sender), "Error: You have no access to burn tokens!");
    _;
  }

  function _burn(address _to, uint _tokenId) internal {
    require(_exist(_tokenId), "Error: This token doesn't exist!");
    require(address(0) != _to, "Error: Burn from zero address!");
    balances[_to]--;
    owners[_tokenId] = address(0);
    emit Transfer(_to, address(0), _tokenId);
  }

  function burnOwnToken(uint _tokenId) public {
    require(owners[_tokenId] == msg.sender, "Error: You can't burn another's token!");
    _burn(msg.sender, _tokenId);
  }

  function burn(address _to, uint _tokenId) public OnlyBurner(msg.sender) {
    _burn(_to, _tokenId);
  }

  function balanceOf(address _owner) view public returns (uint) {
    return balances[_owner];
  }

  mapping (address => uint) balances;
  mapping (uint => address) owners;
  mapping (uint => address) tokenApprovals;
  mapping (address => mapping (address => bool)) operatorApprovals;

  event Transfer (address indexed from, address indexed to, uint indexed tokenId);
  event Approval (address indexed owner, address spender, uint indexed tokenId);
  event ApprovalForAll (address indexed owner, address indexed operator, bool approved);

  function _transfer(address _from, address _to, uint _tokenId) internal {
    require(_to != address(0), "Error: Transfer to zero address!");
    require(isOwner(_from, _tokenId), "Error: This token is not yours!");
    balances[_from] -= 1;
    balances[_to] += 1;
    owners[_tokenId] = _to;
    _approve(address(0), _tokenId);
    emit Transfer(_from, _to, _tokenId);
  }

  function transfer(address _to, uint _tokenId) public {
    _transfer(msg.sender, _to, _tokenId);
  }

  function _approve(address _to, uint _tokenId) internal {
    tokenApprovals[_tokenId] = _to;
    emit Approval(msg.sender, _to, _tokenId);
  }

  function approve(address _spender, uint _tokenId) external {
    require(isOwner(msg.sender, _tokenId), "Error: This token is not yours!");
    require(_spender != address(0), "Error: Approval to zero address!");
    _approve(_spender, _tokenId);
  }

 function approvalForAll(address _operator, bool _approved) external {
    require(_operator != address(0), "Error: Approval to zero address!");
    operatorApprovals[msg.sender][_operator] = _approved;
    emit ApprovalForAll (msg.sender, _operator, _approved);
 }

 function transferFrom(address _from, address _to, uint _tokenId) external {
  require(_exist(_tokenId), "Error: This token doesn't exist!");
  require(isApproved(_to, _tokenId) || isApproved(msg.sender, _tokenId) || (isApprovedForAll(_from, msg.sender) && isOwner(_from, _tokenId)) || (isApprovedForAll(_from, _to) && isOwner(_from, _tokenId)) , "Error: You haven't allowance to transfer this token to your account!");
  _transfer(_from, _to, _tokenId);
  tokenApprovals[_tokenId] = address(0);
 }

function isApproved(address _to, uint _tokenId) view public returns (bool) {
  return tokenApprovals[_tokenId] == _to ? true : false;
}

function isOwner(address _owner, uint _tokenId) view public returns (bool) {
  return owners[_tokenId] == _owner ? true : false;
}

function ownerOf(uint _tokenId) external view returns (address) {
  return owners[_tokenId];
}

function isApprovedForAll(address _owner, address _spender) view public returns (bool) {
  return operatorApprovals[_owner][_spender] == true ? true : false;
}

function _exist(uint _tokenId) view internal returns (bool) {
  return owners[_tokenId] == address(0)? false : true;
}

function exist(uint _tokenId) view public returns (bool) {
  return _exist(_tokenId);
}

function getTokenURI(uint _tokenId) view public returns (string memory) {
  require(_exist(_tokenId), "Error: This token doesn't exist!");
  return _getTokenURI(_tokenId);
}

function getAddress() view public returns(address){
  return address(this);
}

}
