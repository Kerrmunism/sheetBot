const helpContentList = [
  {
    name: 'Calculations',
    aliases: ['calc', '!calc', 'calculations', '!calculations', 'calcs', '!calcs'],
    message: `
    Calculations are performed as follows:
    APP: \`APM/(PPS*60)\`
    DS/Second: \`(VS/100)-(APM/60)\`
    DS/Piece: \`((VS/100)-(APM/60))/PPS\`
    APP+DS/Piece: \`(((VS/100)-(APM/60))/PPS) + APM/(PPS*60)\`
    Cheese Index: \`((DS/Piece * 150) + (((VS/APM)-2)*50) + (0.6-APP)*125))\`
    Garbage Effi.: \`(attack*downstack)/pieces^2\`
    Area: \`apm + pps * 45 + vs * 0.444 + app * 185 + dssecond * 175 + dspiece * 450 + garbageEffi * 315\`
    Weighted APP: \`APP - 5 * tan((cheeseIndex/ -30) + 1)\`
    Est. TR: \`25000/(1+10^(((1500-(0.000013*(((pps * (150 + ((vsapm - 1.66) * 35)) + app * 290 + dspiece * 700))^3) - 0.0196*(((pps * (150 + ((vsapm - 1.66) * 35)) + app * 290 + dspiece * 700))^2) + (12.645*((pps * (150 + ((vsapm - 1.66) * 35)) + app * 290 + dspiece * 700))) - 1005.4))*pi)/(sqrt(((3*ln(10)^2)*60^2)+(2500*((64*pi^2)+(147*ln(10)^2)))))))\`
    `
  },
  {
    name: 'Table Stats',
    aliases: ['ts', '!ts'],
    message: `
    !ts - Displays stats of a user in a table list.
    **Usage**: \`!ts [username]\` or \`!ts [apm] [pps] [vs]\`
    **Extra Parameters:** \`-m\`: To be added at the end of the command. (Ex: \`!ts explorat0ri -m\`). Will display a more minimal output with less stats and clutter.
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    `
  },
  {
    name: 'Versus',
    aliases: ['vs', '!vst'],
    message: `
    \`!vs\` - Compares the stats of two users (or one, if you input one name twice), in a more complicated version of the !sq command radar graph with more stats shown.
    **Usage** - \`!vs [name1] [name2, optional] [name3, optional] [name4, optional] [name5, optional]\`... (many can be added) or \`!vs [apm] [pps] [vs]\`
    **Extra Parameters:** \`-v\`: To be added at the end of the command. (Ex: \`!vs explorat0ri gavorox -v\`). Will display a version of the graph without fill on the colors, aiding visibility with large numbers of players.
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    `
  },
  {
    name: 'Versus - Table',
    aliases: ['vst', '!vst'],
    message: `
    Same thing as \`!vs\`, but it displays everything in a table.
    **Usage** - \`!vst [name1] [name2, optional] [name3, optional]\`... (many can be added) or \`!vst [apm] [pps] [vs]\`
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*
    `
  },
  {
    name: 'SQ',
    aliases: ['sq', '!sq'],
    message: `
    \`!sq\` - Displays stats of users in a small, 4-axis radar graph.
    **Usage** - \`!sq [name] [name2, optional] [name3, optional]\`... (many can be added) or \`!sq [apm] [pps] [vs]\`
    **Extra Parameters:** \`-v\`: To be added at the end of the command. (Ex: \`!sq explorat0ri -v\`). Will display a version of the graph without fill on the colors, aiding visibility with large numbers of players.
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    `
  },
  {
    name: 'PSQ',
    aliases: ['psq', '!psq'],
    message: `
    \`!psq\` - Same thing as sq, but instead of each end being ATTACK, SPEED, DEFENSE and CHEESE, you have OPENER, STRIDE, PLONK and INF DS.
    **Usage** - \`!psq [name] [name2, optional] [name3, optional]\`... (many can be added) or \`!psq [apm] [pps] [vs]\`.
    **Extra Parameters:** \`-v\`, \`-s\`. Both are to be added at the end of the command, though only one may be applied at a time.
    \`-v\`: Will display a version of the graph without fill on the colors, aiding visibility with large numbers of players.
    \`-s\`: Will display a scatter plot instead of the traditional radar graph.
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    `
  },
  {
    name: 'AC',
    aliases: ['ac', '!act'],
    message: `
    \`!ac\` - Compares your stats to every other player and finds the closest person to each, individually.
    **Usage** - \`!ac [name or [apm] [pps] [vs]] [rank or position to start search or "all" for all ranks, optional] [rank or position to end search, optional]\`
    **Examples:** \`!ac explorat0ri 400 4000\`, \`!ac explorat0ri x u\`, \`!ac explorat0ri all\`
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    (*This command uses unranked players. They will show when setting your first position as 0, including \`z\` in the rank search or if no filters for rank or position are set.*)
    `,
  },
  {
    name: 'Leaderboard',
    aliases: ['lb', '!lb'],
    message: `
    \`!lb\` - Displays a leaderboard of the top players in a certain stat category, based on how many you want to display and search through.
    **Usage** - \`!lb [any stat name] [how many places to display (ex, 10 for top 10)] [rank or position to start search, optional], [rank or position to stop search, optional], [country using 2-letter area code, "LATAM", "E.U" or "null", optional]\`
    **Extra Parameters:** \`p#\` : To be added at the end or before the country parameter if one is included, either works. Acts as a page, changing the number after the p will give a different page. For example, \`!lb apm 20\` will display #1-#20, while \`!lb apm 20 p2\` will display #21-39"
    **Examples:** \`!lb apm 10 jp\`, \`!lb esttr 25 u p2\`, \`!lb cheese 40 S+ 25000\`, \`!lb app 20 u 1000 us\`
    (*This command uses unranked players. They will show when setting your first position as 0, including \`z\` in the rank search or if no filters for rank or position are set.*)
    `
  },
  {
    name: 'Reversed Leaderboard',
    aliases: ['rlb', '!rlb'],
    message: `
    \`!rlb\` - Same as \`!lb\` but finds the *bottom* players. Everything else operates the same way.
    `
  },
  {
    name: 'Closest Player',
    aliases: ['cc', '!cc'],
    message: `
    \`!cc\` - Finds the closest player to you in both rate stats and overall.
    **Usage** - \`!cc [name or [apm] [pps] [vs]] [display number]\`
    **Extra Parameters:** \`playstyle\`, \`all\`, \`rate\`, \`norate\`: All to be placed between the name and display number, though only one should be used at a time. Will make the command display only that respective category.
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    (*This command uses unranked players. They will show when setting your first position as 0, including \`z\` in the rank search or if no filters for rank or position are set.*)
    `
  },
  {
    name: 'Average',
    aliases: ['avg', '!avg'],
    message: `
    \`!avg\` - Finds the average stats for a group of players.
    **Usage** - \`!avg [rank or position to start search or the word "all"] [rank or position to end the search, optional] [country using 2-letter area code, "LATAM", "E.U" or "null", optional]
    `
  },
  {
    name: 'Med',
    aliases: ['med', '!med'],
    message: `
    \`!med\` - Finds the median stats for a group of players. Functions identically to !avg in terms of parameters.
    `
  },
  {
    name: 'Rank',
    aliases: ['rnk', '!rnk'],
    message: `
    \`!rnk\` - Determines the placement of your stats among a group of players. You can think of it as showing your placement of each stat on the \`!lb\` command.
    **Usage** - \`!rnk [name or [apm] [pps] [vs]] [rank or position to start search at, optional] [rank or position to end search at, optional] [country using 2-letter code, "LATAM", "E.U" or "null", optional]\`
    (*This command supports the use of average players. To use, simply type \`$avg[rank]\` where a player would be entered.*)
    `
  },
  {
    name: 'Unranked players',
    aliases: ['z', '!z'],
    message:`
    \`!z\` - Handles the list of unranked players.
    **Usage** - \`!z [list] [the word “id”, optional]\` or \`!z [add/remove] [username or player ID.]\`
    `
  },
  {
    name: 'Refresh',
    aliases: ['refresh', '!refresh'],
    message: `
    \`!refresh\` - Refreshes all of the players for commands like \`!lb\`, \`!avg\`, \`!ac\`, etc. Please do not use this command more than once an hour.
    `
  },
  {
    name: 'Versus Relative',
    aliases: ['vsr', '!vsr'],
    message: `
    \`!vsr\` - Same as \`!vs\`, but tries to show the values relative to each other. Useful especially for lower ranked players.
    `
  },
  {
    name: 'O',
    aliases: ['o', '!o'],
    message: `
    \`!o\` - A command that lists people that fit under a certain criteria. Any criteria supported by \`!lb\` will be supported here as well.
    **Usage** - \`!o [stat][<, = or >][number, or rank if stat is rank]\`
    {These three brackets can be repeated as many times as you want to further narrow down a player.}
    `
  },
  {
    name: 'Default',
    aliases: ['default'],
    message: `
    List of commands: \`ts, vs, vst, vsr, sq, psq, lb, rlb, ac, cc, avg, med, o, z, refresh, rnk\`
    Use \`!help [command]\` for more info on any specific command.
    You can also type \`!help calcs\` for calculation info.
    `
  }
]

