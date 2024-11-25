// Import socket.io-client
import { io } from "socket.io-client";

// Kết nối đến server
const socket = io.connect('http://localhost:80', { reconnect: true, transports: ['websocket'] });
socket.on("connect", () => {
  console.log("Connected to server:", socket.id);							
});	

const gameId = "9a830d55-d278-447e-bde9-3d641f1be996";
const playerId1 = "player1-xxx";


const currentPosition = [];
let direction = [];
let tag;
const blockedPositions = [[0,0]]
const oppPosition = []
let bombs = [];
let isMarrying = false

// API-1a: Người chơi tham gia trò chơi
socket.emit('join game', { game_id: gameId, player_id: playerId1 });

// API-1b: Lắng nghe phản hồi khi người chơi tham gia trò chơi
socket.on('join game', (res) => {
  console.log('[Socket] join-game response', res);
});

// API-4: Đăng ký sức mạnh nhân vật
socket.emit('register character power', { "gameId": gameId, "type": 1 });
socket.emit('action', { "action": "switch weapon" });
socket.emit('action', { "action": "use weapon" });

// Lắng nghe sự kiện ticktack từ server và xử lý ngay lập tức
socket.on('ticktack player', (res) => {
  const players = res.map_info.players
  const index_player = find_index_player(players)
  const index_opp = find_index_opp(players)
  if (players[index_player]["id"] === playerId1) {
    currentPosition[0] = players[index_player]['currentPosition']['row'];
    currentPosition[1] = players[index_player]['currentPosition']['col'];

    if (isMarrying === false)
    {
      oppPosition[0] = players[index_opp]['currentPosition']['row'];
      oppPosition[1] = players[index_opp]['currentPosition']['col'];
      blockedPositions.push(oppPosition)
    }

    const isTransformed = players[index_player]['hasTransform']
    console.log(isTransformed)
    const map = res.map_info.map;
    tag = res.tag;

    bombs = res.map_info.bombs

    const player = players[0]
    const stickyRice = player['stickyRice']
    const chungCake = player['chungCake']
    const nineManeHairHorse = player['nineManeHairHorse']
    const nineTuskElephant = player['nineTuskElephant']
    const nineSpurRooster = player['nineSpurRooster']
    const holySpiritStone = player['holySpiritStone']
    const eternalBadge = player['eternalBadge']

    console.log(bombs)

    const maxRow = res.map_info.size['rows']
    const maxCol = res.map_info.size['cols']

    const currentWeapon = players[index_player]['currentWeapon'];
    if (tag === "player:into-wedding-room")
    {
      isMarrying = true;
    }
    if (tag === "player:completed wedding")
    {
      isMarrying = false;
    }
    // if (player[index_player]['isChild'] != null && 
    //     player[index_player]['isChild'] === true) {
      // if (stickyRice >= 1 && chungCake >= 1 && nineManeHairHorse >= 1 
      //   && nineTuskElephant >= 1 && nineSpurRooster >= 1 && holySpiritStone >= 1)
      // {
      //   socket.emit('action', { "action": "marry wife" });
      // }
    //}
    if (bombs.length != 0 && isTransformed === true)
    {
      bombs.forEach(bomb => {
        if (bomb['remainTime'] != 0)
          {
            const bombPos = []
            bombPos[0] = bomb['row']
            bombPos[1] = bomb['col']
            direction = god_avoid_bomb(map, bombPos, bombs)
            direction.forEach(element => {
              if (element === "switch weapon") {
                socket.emit('action', { "action": "switch weapon" });
              } else {
                socket.emit('drive player', { "direction": `${element}` });
              }
            });
            // if (direction[0] === "switch weapon"){
            //   socket.emit('action', { "action": "switch weapon" });
            // } else {
            //   socket.emit('drive player', { "direction": `${direction[0]}` });
            // }
            // direction.shift()
          }
      })
    }
    else
    {
      if (isTransformed === false)
      {
        const availPos = [0, 3, 6]
        direction = calculate_direction(6, map, currentPosition, blockedPositions, availPos, currentWeapon, bombs)
      } else {
        const availPos = [0, 2, 3, 6]
        const dangerZones = calculateDangerZones(currentPosition, bombs);
        console.log("danger: ", dangerZones)
        blockedPositions.concat(dangerZones)
        direction = calculate_direction(2, map, currentPosition, blockedPositions, availPos, currentWeapon, bombs)
      }
      console.log(direction)
      direction.forEach(element => {
        if (element === "switch weapon") {
          socket.emit('action', { "action": "switch weapon" });
        } else {
          socket.emit('drive player', { "direction": `${element}` });
        }
      });
      // if (direction[0] === "switch weapon"){
      //   socket.emit('action', { "action": "switch weapon" });
      // } else {
      //   socket.emit('drive player', { "direction": `${direction[0]}` });
      // }
      // direction.shift()
    }
  }
});

function findShortestPathFromStart(goal, grid, start, blockedPositions, availPos) {
  const rows = grid.length;
  const cols = grid[0].length;
  const directions = [
      [-1, 0], // Lên
      [1, 0],  // Xuống
      [0, -1], // Trái
      [0, 1]   // Phải
  ];

  // Kiểm tra điểm bắt đầu hợp lệ
  const [startX, startY] = start;
  if (![0, 2, 3, 5, 6].includes(grid[startX][startY])) {
      return "Điểm bắt đầu không hợp lệ";
  }

  // Chuyển đổi `blockedPositions` thành tập hợp để tra cứu nhanh
  const blockedSet = new Set(blockedPositions.map(([x, y]) => `${x},${y}`));

  // BFS
  const queue = [[start, [start]]]; // [[vị trí hiện tại], [đường đi]]
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
      const [[x, y], path] = queue.shift();

      // Nếu tìm thấy mục tiêu
      if (grid[x][y] === goal) {
          return path;
      }

      // Duyệt qua các ô lân cận
      for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;

          // Kiểm tra ô hợp lệ, chưa được thăm, không bị chặn, và có thể đi qua
          if (
              nx >= 0 && nx < rows && ny >= 0 && ny < cols &&
              !visited.has(`${nx},${ny}`) &&
              !blockedSet.has(`${nx},${ny}`) &&
              availPos.includes(grid[nx][ny])
          ) {
              queue.push([[nx, ny], [...path, [nx, ny]]]);
              visited.add(`${nx},${ny}`);
          }
      }
  }

  return "Không tìm được đường đi đến mục tiêu";
}

function calculate_direction(goal, grid, startPosition, blockedPositions, availPos, currentWeapon, bombs) {

  const shortestPath = findShortestPathFromStart(goal, grid, startPosition, blockedPositions, availPos)
  console.log(shortestPath)

   let direction = [];
    for (const [x, y] of shortestPath) {
        if (startPosition != [x, y])
        {
            if (startPosition[0]-x === -1 && startPosition[1]-y===0) {
                direction.push(4)
            } else if (startPosition[0]-x === 1 && startPosition[1] - y === 0) {
                direction.push(3)
            } else if (startPosition[1]-y === -1 && startPosition[0] - x === 0) {
                direction.push(2)
            } else if (startPosition[1]-y === 1 && startPosition[0] - x === 0) {
                direction.push(1)
            }
            console.log('grid[x][y]: ', grid[x][y])
            if (grid[x][y] === 3 ){
                direction.push("b")
                if (currentWeapon === 2)
                  {direction.push('switch weapon')}
                  direction.push("b")
            }
            else if (grid[x][y] === 2 ){
                if (currentWeapon === 1)
                    {direction.push('switch weapon')}
                direction.push("b")
                
            }
            if (grid[x][y] === 6){
                direction.push("x")
            }
            startPosition[0] = x;
            startPosition[1] = y;
        }
    }
    return direction;
}

function calculateDangerZones(curPos, bombs)
{
  
}

function god_avoid_bomb(grid, bombPosition, bombs) {
  const dx = bombPosition[0]
    const dy = bombPosition[1]
    let direction_avoid = []
    if (grid[dx-1][dy] === 0)
    {
      if (grid[dx-1][dy-1] === 0)
      {
        direction_avoid.push(3, 1);
      } else if (grid[dx-1][dy-1] === 3)
      {
        direction_avoid.push(3, 1, 'b', 1);
      } 
      if (grid[dx-1][dy+1] === 0)
      {
        direction_avoid.push(3, 2);
      } else if (grid[dx-1][dy+1] === 3) 
      {
        direction_avoid.push(3, 2, 'b', 2);
      }
    }
    if (grid[dx][dy-1] === 0)
    {
      if (grid[dx-1][dy-1] === 0)
      {
        direction_avoid.push(1, 3);
      } else if (grid[dx-1][dy-1] === 0)
      {
        direction_avoid.push(1, 3, 'b', 3);
      } 
      if (grid[dx+1][dy-1] === 0)
      {
        direction_avoid.push(1, 4);
      } else if (grid[dx+1][dy-1] === 3) {
        direction_avoid.push(1, 4, 'b', 4);
      }
    }
    if (grid[dx+1][dy] === 0)
    {
      if (grid[dx+1][dy-1] === 0)
      {
        direction_avoid.push(4, 1);
      } else if (grid[dx+1][dy-1] === 3) {
        direction_avoid.push(4, 1, 'b', 1);
      }
      if (grid[dx+1][dy+1] === 0)
      {
        direction_avoid.push(4, 2);
      } else if (grid[dx+1][dy+1] === 3) 
      {
        direction_avoid.push(4, 2, 'b', 2);
      }
    }
    if (grid[dx][dy+1] === 0)
    {
      if (grid[dx-1][dy+1] === 0)
      {
        direction_avoid.push(2, 3);
      } else if (grid[dx-1][dy+1] === 3) {
        direction_avoid.push(2, 3, 'b', 3);
      }
      if (grid[dx+1][dy+1] === 0)
      {
        direction_avoid.push(2, 4);
      } else if (grid[dx+1][dy+1] === 3) {
        direction_avoid.push(2, 4, 'b', 4);
      }
    }

    return direction_avoid;
}

function find_index_player(players)
{
  for (let i = 0; i < players.length; i++) {
    if (players[i]['id'] === "player1-xxx")
    {
      return i
    }
  }
}

function find_index_opp(players)
{
  for (let i = 0; i < players.length; i++) {
    if (players[i]['id'] === "player2-xxx")
    {
      return i
    }
  }
}


