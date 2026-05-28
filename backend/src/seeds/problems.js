const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const defaultReturnByType = {
  javascript: {
    array: "[]",
    number: "0",
    boolean: "false",
    string: "\"\"",
    object: "{}",
    listnode: "null",
    treenode: "null",
  },
  python: {
    array: "[]",
    number: "0",
    boolean: "False",
    string: "\"\"",
    object: "{}",
    listnode: "None",
    treenode: "None",
  },
  cpp: {
    array: "{}",
    number: "0",
    boolean: "false",
    string: "\"\"",
    object: "{}",
    listnode: "nullptr",
    treenode: "nullptr",
  },
  java: {
    array: "new int[0]",
    number: "0",
    boolean: "false",
    string: "\"\"",
    object: "new java.util.HashMap<>()",
    listnode: "null",
    treenode: "null",
  },
};

const listNodeDefs = {
  python:
    "class ListNode:\n" +
    "    def __init__(self, val=0, next=None):\n" +
    "        self.val = val\n" +
    "        self.next = next\n\n",
  cpp:
    "struct ListNode {\n" +
    "    int val;\n" +
    "    ListNode* next;\n" +
    "    ListNode(int x) : val(x), next(nullptr) {}\n" +
    "    ListNode(int x, ListNode* next) : val(x), next(next) {}\n" +
    "};\n\n",
  java:
    "class ListNode {\n" +
    "    int val;\n" +
    "    ListNode next;\n" +
    "    ListNode(int val) { this.val = val; }\n" +
    "    ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n" +
    "}\n\n",
};

const treeNodeDefs = {
  python:
    "class TreeNode:\n" +
    "    def __init__(self, val=0, left=None, right=None):\n" +
    "        self.val = val\n" +
    "        self.left = left\n" +
    "        self.right = right\n\n",
  cpp:
    "struct TreeNode {\n" +
    "    int val;\n" +
    "    TreeNode* left;\n" +
    "    TreeNode* right;\n" +
    "    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n" +
    "    TreeNode(int x, TreeNode* left, TreeNode* right) : val(x), left(left), right(right) {}\n" +
    "};\n\n",
  java:
    "class TreeNode {\n" +
    "    int val;\n" +
    "    TreeNode left;\n" +
    "    TreeNode right;\n" +
    "    TreeNode(int val) { this.val = val; }\n" +
    "    TreeNode(int val, TreeNode left, TreeNode right) {\n" +
    "        this.val = val;\n" +
    "        this.left = left;\n" +
    "        this.right = right;\n" +
    "    }\n" +
    "}\n\n",
};

const graphNodeDefs = {
  python:
    "class Node:\n" +
    "    def __init__(self, val=0, neighbors=None):\n" +
    "        self.val = val\n" +
    "        self.neighbors = neighbors if neighbors is not None else []\n\n",
  cpp:
    "class Node {\n" +
    "public:\n" +
    "    int val;\n" +
    "    vector<Node*> neighbors;\n" +
    "    Node() : val(0) {}\n" +
    "    Node(int _val) : val(_val) {}\n" +
    "    Node(int _val, vector<Node*> _neighbors) : val(_val), neighbors(_neighbors) {}\n" +
    "};\n\n",
  java:
    "class Node {\n" +
    "    public int val;\n" +
    "    public java.util.List<Node> neighbors;\n" +
    "    public Node() {\n" +
    "        val = 0;\n" +
    "        neighbors = new java.util.ArrayList<>();\n" +
    "    }\n" +
    "    public Node(int _val) {\n" +
    "        val = _val;\n" +
    "        neighbors = new java.util.ArrayList<>();\n" +
    "    }\n" +
    "    public Node(int _val, java.util.List<Node> _neighbors) {\n" +
    "        val = _val;\n" +
    "        neighbors = _neighbors;\n" +
    "    }\n" +
    "}\n\n",
};

const buildStarterCode = ({
  functionName,
  jsArgs,
  pyArgs,
  cppArgs,
  javaArgs,
  cppReturnType,
  javaReturnType,
  jsReturnType = "object",
  pyReturnType = "object",
  cppReturnValue,
  javaReturnValue,
  prefix = {},
}) => {
  const jsReturn =
    defaultReturnByType.javascript[jsReturnType] ||
    defaultReturnByType.javascript.object;
  const pyReturn =
    defaultReturnByType.python[pyReturnType] ||
    defaultReturnByType.python.object;
  const cppReturn =
    cppReturnValue ||
    defaultReturnByType.cpp[cppReturnType] ||
    defaultReturnByType.cpp.object;
  const javaReturn =
    javaReturnValue ||
    defaultReturnByType.java[javaReturnType] ||
    defaultReturnByType.java.object;

  return {
    javascript:
      (prefix.javascript || "") +
      `function ${functionName}(${jsArgs}) {\n` +
      "  // TODO: implement\n" +
      `  return ${jsReturn};\n` +
      "}\n",
    python:
      (prefix.python || "") +
      `def ${functionName}(${pyArgs}):\n` +
      "    # TODO: implement\n" +
      `    return ${pyReturn}\n`,
    cpp:
      (prefix.cpp || "") +
      "class Solution {\n" +
      "public:\n" +
      `    ${cppReturnType} ${functionName}(${cppArgs}) {\n` +
      "        // TODO: implement\n" +
      `        return ${cppReturn};\n` +
      "    }\n" +
      "};\n",
    java:
      (prefix.java || "") +
      "class Solution {\n" +
      `    public ${javaReturnType} ${functionName}(${javaArgs}) {\n` +
      "        // TODO: implement\n" +
      `        return ${javaReturn};\n` +
      "    }\n" +
      "}\n",
  };
};

const buildProblem = (problem) => {
  const baseSlug = problem.slug || slugify(problem.title);
  return {
    acceptanceRate: 42,
    companyTags: [],
    categories: [],
    hints: [],
    editorialSummary: "",
    estimatedFrequency: 3,
    relatedTopics: [],
    testCases: (problem.examples || []).map((example) => ({
      input: example.input,
      expectedOutput: example.output,
    })),
    ...problem,
    slug: baseSlug,
  };
};

const rawProblems = [
  buildProblem({
    title: "Two Sum",
    difficulty: "easy",
    tags: ["arrays", "hashing"],
    categories: ["Blind 75", "Arrays", "Interview Essentials"],
    description:
      "Given an array of integers nums and an integer target, return the indices of the two numbers such that they add up to target. You may assume exactly one solution exists, and you may not use the same element twice.",
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "nums[0] + nums[1] = 2 + 7 = 9",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
    ],
    starterCode: buildStarterCode({
      functionName: "twoSum",
      jsArgs: "nums, target",
      pyArgs: "nums, target",
      cppArgs: "vector<int>& nums, int target",
      javaArgs: "int[] nums, int target",
      cppReturnType: "vector<int>",
      javaReturnType: "int[]",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new int[0]",
    }),
    acceptanceRate: 47,
    companyTags: ["Amazon", "Microsoft"],
    hints: ["Use a hash map to store complements."],
    editorialSummary: "Track values seen so far so each lookup is O(1).",
    estimatedFrequency: 5,
    relatedTopics: ["hash maps"],
  }),
  buildProblem({
    title: "Valid Anagram",
    difficulty: "easy",
    tags: ["strings", "hashing"],
    categories: ["Strings", "Interview Essentials"],
    description:
      "Given two strings s and t, return true if t is an anagram of s, and false otherwise.",
    examples: [
      {
        input: "s = \"anagram\", t = \"nagaram\"",
        output: "true",
        explanation: "Both strings contain the same character counts.",
      },
    ],
    constraints: ["1 <= s.length, t.length <= 10^5", "s and t are lowercase"],
    starterCode: buildStarterCode({
      functionName: "isAnagram",
      jsArgs: "s, t",
      pyArgs: "s, t",
      cppArgs: "string s, string t",
      javaArgs: "String s, String t",
      cppReturnType: "bool",
      javaReturnType: "boolean",
      jsReturnType: "boolean",
      pyReturnType: "boolean",
    }),
    acceptanceRate: 61,
    companyTags: ["Google"],
    hints: ["Count characters in one string and decrement for the other."],
    editorialSummary: "Frequency comparison yields linear time.",
    relatedTopics: ["frequency counting"],
  }),
  buildProblem({
    title: "Best Time to Buy and Sell Stock",
    difficulty: "easy",
    tags: ["arrays", "greedy"],
    categories: ["Arrays", "Interview Essentials"],
    description:
      "You are given an array prices where prices[i] is the price of a given stock on day i. Return the maximum profit you can achieve from a single buy and a single sell.",
    examples: [
      {
        input: "prices = [7,1,5,3,6,4]",
        output: "5",
        explanation: "Buy at 1 and sell at 6.",
      },
    ],
    constraints: ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
    starterCode: buildStarterCode({
      functionName: "maxProfit",
      jsArgs: "prices",
      pyArgs: "prices",
      cppArgs: "vector<int>& prices",
      javaArgs: "int[] prices",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 54,
    companyTags: ["Meta", "Amazon"],
    hints: ["Track the minimum price so far."],
    editorialSummary: "Single pass with min price and max profit.",
    relatedTopics: ["one pass"],
  }),
  buildProblem({
    title: "Binary Search",
    difficulty: "easy",
    tags: ["binary search", "arrays"],
    categories: ["Arrays", "Interview Essentials"],
    description:
      "Given a sorted array of integers nums and an integer target, return the index of target if it exists. Otherwise return -1.",
    examples: [
      {
        input: "nums = [-1,0,3,5,9,12], target = 9",
        output: "4",
        explanation: "Target is at index 4.",
      },
    ],
    constraints: ["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4"],
    starterCode: buildStarterCode({
      functionName: "search",
      jsArgs: "nums, target",
      pyArgs: "nums, target",
      cppArgs: "vector<int>& nums, int target",
      javaArgs: "int[] nums, int target",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 58,
    companyTags: ["Microsoft"],
    hints: ["Classic low/high pointers."],
    editorialSummary: "Binary search runs in O(log n).",
  }),
  buildProblem({
    title: "Merge Two Sorted Lists",
    difficulty: "easy",
    tags: ["linked lists"],
    categories: ["Linked Lists", "Interview Essentials"],
    description:
      "Given two sorted linked lists, merge them into a single sorted list and return its head.",
    examples: [
      {
        input: "l1 = [1,2,4], l2 = [1,3,4]",
        output: "[1,1,2,3,4,4]",
        explanation: "Merge node by node.",
      },
    ],
    constraints: ["0 <= list length <= 50", "-100 <= node value <= 100"],
    starterCode: buildStarterCode({
      functionName: "mergeTwoLists",
      jsArgs: "l1, l2",
      pyArgs: "l1, l2",
      cppArgs: "ListNode* l1, ListNode* l2",
      javaArgs: "ListNode l1, ListNode l2",
      cppReturnType: "ListNode*",
      javaReturnType: "ListNode",
      jsReturnType: "listnode",
      pyReturnType: "listnode",
      prefix: {
        cpp: listNodeDefs.cpp,
        java: listNodeDefs.java,
        python: listNodeDefs.python,
      },
      cppReturnValue: "nullptr",
      javaReturnValue: "null",
    }),
    acceptanceRate: 62,
    companyTags: ["Google"],
    hints: ["Use a dummy head to simplify merges."],
    editorialSummary: "Iterate while picking the smaller head.",
  }),
  buildProblem({
    title: "Invert Binary Tree",
    difficulty: "easy",
    tags: ["trees", "recursion"],
    categories: ["Trees", "Interview Essentials"],
    description:
      "Given the root of a binary tree, invert the tree and return its root.",
    examples: [
      {
        input: "root = [4,2,7,1,3,6,9]",
        output: "[4,7,2,9,6,3,1]",
        explanation: "Swap left and right subtrees recursively.",
      },
    ],
    constraints: ["0 <= nodes <= 100", "-100 <= Node.val <= 100"],
    starterCode: buildStarterCode({
      functionName: "invertTree",
      jsArgs: "root",
      pyArgs: "root",
      cppArgs: "TreeNode* root",
      javaArgs: "TreeNode root",
      cppReturnType: "TreeNode*",
      javaReturnType: "TreeNode",
      jsReturnType: "treenode",
      pyReturnType: "treenode",
      prefix: {
        cpp: treeNodeDefs.cpp,
        java: treeNodeDefs.java,
        python: treeNodeDefs.python,
      },
      cppReturnValue: "nullptr",
      javaReturnValue: "null",
    }),
    acceptanceRate: 69,
    companyTags: ["Meta"],
    hints: ["Recursive post-order traversal."],
    editorialSummary: "Swap children at each node.",
  }),
  buildProblem({
    title: "Implement Queue Using Stacks",
    difficulty: "easy",
    tags: ["stacks", "queues"],
    categories: ["Stacks", "Interview Essentials"],
    description:
      "Implement a first in first out (FIFO) queue using two stacks.",
    examples: [
      {
        input: "push 1, push 2, peek, pop, empty",
        output: "1, 1, false",
        explanation: "Two-stack transfer preserves order.",
      },
    ],
    constraints: ["1 <= operations <= 10^4"],
    starterCode: {
      javascript:
        "class MyQueue {\n" +
        "  constructor() {\n" +
        "    // TODO: initialize your data structure\n" +
        "  }\n\n" +
        "  push(x) {\n" +
        "    // TODO: implement\n" +
        "  }\n\n" +
        "  pop() {\n" +
        "    // TODO: implement\n" +
        "    return null;\n" +
        "  }\n\n" +
        "  peek() {\n" +
        "    // TODO: implement\n" +
        "    return null;\n" +
        "  }\n\n" +
        "  empty() {\n" +
        "    // TODO: implement\n" +
        "    return false;\n" +
        "  }\n" +
        "}\n",
      python:
        "class MyQueue:\n" +
        "    def __init__(self):\n" +
        "        # TODO: initialize your data structure\n" +
        "        pass\n\n" +
        "    def push(self, x):\n" +
        "        # TODO: implement\n" +
        "        pass\n\n" +
        "    def pop(self):\n" +
        "        # TODO: implement\n" +
        "        return None\n\n" +
        "    def peek(self):\n" +
        "        # TODO: implement\n" +
        "        return None\n\n" +
        "    def empty(self):\n" +
        "        # TODO: implement\n" +
        "        return False\n",
      cpp:
        "class MyQueue {\n" +
        "public:\n" +
        "    MyQueue() {\n" +
        "        // TODO: initialize your data structure\n" +
        "    }\n\n" +
        "    void push(int x) {\n" +
        "        // TODO: implement\n" +
        "    }\n\n" +
        "    int pop() {\n" +
        "        // TODO: implement\n" +
        "        return 0;\n" +
        "    }\n\n" +
        "    int peek() {\n" +
        "        // TODO: implement\n" +
        "        return 0;\n" +
        "    }\n\n" +
        "    bool empty() {\n" +
        "        // TODO: implement\n" +
        "        return false;\n" +
        "    }\n" +
        "};\n",
      java:
        "class MyQueue {\n" +
        "    public MyQueue() {\n" +
        "        // TODO: initialize your data structure\n" +
        "    }\n\n" +
        "    public void push(int x) {\n" +
        "        // TODO: implement\n" +
        "    }\n\n" +
        "    public int pop() {\n" +
        "        // TODO: implement\n" +
        "        return 0;\n" +
        "    }\n\n" +
        "    public int peek() {\n" +
        "        // TODO: implement\n" +
        "        return 0;\n" +
        "    }\n\n" +
        "    public boolean empty() {\n" +
        "        // TODO: implement\n" +
        "        return false;\n" +
        "    }\n" +
        "}\n",
    },
    acceptanceRate: 55,
    companyTags: ["Amazon"],
    hints: ["Use one stack for input and one for output."],
    editorialSummary: "Amortized O(1) per operation.",
  }),
  buildProblem({
    title: "First Unique Character",
    difficulty: "easy",
    tags: ["strings", "hashing"],
    categories: ["Strings"],
    description:
      "Given a string s, return the index of the first non-repeating character. Return -1 if none exists.",
    examples: [
      {
        input: "s = \"leetcode\"",
        output: "0",
        explanation: "The first unique character is 'l'.",
      },
    ],
    constraints: ["1 <= s.length <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "firstUniqChar",
      jsArgs: "s",
      pyArgs: "s",
      cppArgs: "string s",
      javaArgs: "String s",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 52,
    companyTags: ["Uber"],
    hints: ["Count frequency, then scan again."],
    editorialSummary: "Two-pass with frequency array.",
  }),
  buildProblem({
    title: "Flood Fill",
    difficulty: "easy",
    tags: ["graphs", "recursion", "bfs"],
    categories: ["Graphs", "Interview Essentials"],
    description:
      "Given an image represented by a matrix of integers, perform a flood fill starting from a given cell and replace the connected region with a new color.",
    examples: [
      {
        input: "image = [[1,1,1],[1,1,0],[1,0,1]], sr = 1, sc = 1, color = 2",
        output: "[[2,2,2],[2,2,0],[2,0,1]]",
        explanation: "Fill the connected 1s region.",
      },
    ],
    constraints: ["1 <= image.length, image[0].length <= 50"],
    starterCode: buildStarterCode({
      functionName: "floodFill",
      jsArgs: "image, sr, sc, color",
      pyArgs: "image, sr, sc, color",
      cppArgs: "vector<vector<int>>& image, int sr, int sc, int color",
      javaArgs: "int[][] image, int sr, int sc, int color",
      cppReturnType: "vector<vector<int>>",
      javaReturnType: "int[][]",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new int[0][0]",
    }),
    acceptanceRate: 64,
    companyTags: ["Google"],
    hints: ["DFS or BFS both work."],
    editorialSummary: "Traverse connected component and repaint.",
  }),
  buildProblem({
    title: "Range Sum Query - Immutable",
    difficulty: "easy",
    tags: ["arrays", "prefix sum"],
    categories: ["Arrays"],
    description:
      "Given an integer array nums, handle multiple queries of the form sumRange(left, right). Return the sum of elements between left and right inclusive.",
    examples: [
      {
        input: "nums = [-2,0,3,-5,2,-1], sumRange(0,2)",
        output: "1",
        explanation: "-2 + 0 + 3 = 1",
      },
    ],
    constraints: ["1 <= nums.length <= 10^4", "-10^5 <= nums[i] <= 10^5"],
    starterCode: {
      javascript:
        "class NumArray {\n" +
        "  constructor(nums) {\n" +
        "    // TODO: build prefix sums\n" +
        "  }\n\n" +
        "  sumRange(left, right) {\n" +
        "    // TODO: return range sum\n" +
        "    return 0;\n" +
        "  }\n" +
        "}\n",
      python:
        "class NumArray:\n" +
        "    def __init__(self, nums):\n" +
        "        # TODO: build prefix sums\n" +
        "        pass\n\n" +
        "    def sumRange(self, left, right):\n" +
        "        # TODO: return range sum\n" +
        "        return 0\n",
      cpp:
        "class NumArray {\n" +
        "public:\n" +
        "    NumArray(vector<int>& nums) {\n" +
        "        // TODO: build prefix sums\n" +
        "    }\n\n" +
        "    int sumRange(int left, int right) {\n" +
        "        // TODO: return range sum\n" +
        "        return 0;\n" +
        "    }\n" +
        "};\n",
      java:
        "class NumArray {\n" +
        "    public NumArray(int[] nums) {\n" +
        "        // TODO: build prefix sums\n" +
        "    }\n\n" +
        "    public int sumRange(int left, int right) {\n" +
        "        // TODO: return range sum\n" +
        "        return 0;\n" +
        "    }\n" +
        "}\n",
    },
    acceptanceRate: 59,
    companyTags: ["Microsoft"],
    hints: ["Store prefix sums for O(1) queries."],
    editorialSummary: "Prefix sums remove repeated work.",
  }),
  buildProblem({
    title: "Longest Substring Without Repeating Characters",
    difficulty: "medium",
    tags: ["strings", "sliding window", "hashing"],
    categories: ["Blind 75", "Strings"],
    description:
      "Given a string s, find the length of the longest substring without repeating characters.",
    examples: [
      {
        input: "s = \"abcabcbb\"",
        output: "3",
        explanation: "The answer is \"abc\".",
      },
    ],
    constraints: ["0 <= s.length <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "lengthOfLongestSubstring",
      jsArgs: "s",
      pyArgs: "s",
      cppArgs: "string s",
      javaArgs: "String s",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 36,
    companyTags: ["Amazon", "Google"],
    hints: ["Use a sliding window with last seen indices."],
    editorialSummary: "Expand window and shrink on repeats.",
  }),
  buildProblem({
    title: "Group Anagrams",
    difficulty: "medium",
    tags: ["strings", "hashing"],
    categories: ["Strings", "Interview Essentials"],
    description:
      "Given an array of strings, group the anagrams together.",
    examples: [
      {
        input: "strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]",
        output: "[[\"eat\",\"tea\",\"ate\"],[\"tan\",\"nat\"],[\"bat\"]]",
        explanation: "Anagrams share the same sorted key.",
      },
    ],
    constraints: ["1 <= strs.length <= 10^4", "1 <= strs[i].length <= 100"],
    starterCode: buildStarterCode({
      functionName: "groupAnagrams",
      jsArgs: "strs",
      pyArgs: "strs",
      cppArgs: "vector<string>& strs",
      javaArgs: "String[] strs",
      cppReturnType: "vector<vector<string>>",
      javaReturnType: "java.util.List<java.util.List<String>>",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new java.util.ArrayList<>()",
    }),
    acceptanceRate: 53,
    companyTags: ["Uber"],
    hints: ["Sort each string or use a 26-char count key."],
    editorialSummary: "Hash on normalized key.",
  }),
  buildProblem({
    title: "Merge Intervals",
    difficulty: "medium",
    tags: ["arrays", "sorting"],
    categories: ["Arrays", "Interview Essentials"],
    description:
      "Given an array of intervals, merge all overlapping intervals and return a new array of non-overlapping intervals.",
    examples: [
      {
        input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
        output: "[[1,6],[8,10],[15,18]]",
        explanation: "Intervals [1,3] and [2,6] overlap.",
      },
    ],
    constraints: ["1 <= intervals.length <= 10^4"],
    starterCode: buildStarterCode({
      functionName: "merge",
      jsArgs: "intervals",
      pyArgs: "intervals",
      cppArgs: "vector<vector<int>>& intervals",
      javaArgs: "int[][] intervals",
      cppReturnType: "vector<vector<int>>",
      javaReturnType: "int[][]",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new int[0][0]",
    }),
    acceptanceRate: 49,
    companyTags: ["Amazon"],
    hints: ["Sort by start time before merging."],
    editorialSummary: "Track current interval and extend as needed.",
  }),
  buildProblem({
    title: "Three Sum",
    difficulty: "medium",
    tags: ["arrays", "two pointers"],
    categories: ["Arrays", "Blind 75"],
    description:
      "Given an integer array nums, return all unique triplets [nums[i], nums[j], nums[k]] such that they sum to zero.",
    examples: [
      {
        input: "nums = [-1,0,1,2,-1,-4]",
        output: "[[-1,-1,2],[-1,0,1]]",
        explanation: "Sort and use two pointers for each i.",
      },
    ],
    constraints: ["0 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "threeSum",
      jsArgs: "nums",
      pyArgs: "nums",
      cppArgs: "vector<int>& nums",
      javaArgs: "int[] nums",
      cppReturnType: "vector<vector<int>>",
      javaReturnType: "java.util.List<java.util.List<Integer>>",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new java.util.ArrayList<>()",
    }),
    acceptanceRate: 32,
    companyTags: ["Meta", "Google"],
    hints: ["Sort to avoid duplicates easily."],
    editorialSummary: "Fix one index, then two-sum on the rest.",
  }),
  buildProblem({
    title: "Product of Array Except Self",
    difficulty: "medium",
    tags: ["arrays", "prefix sum"],
    categories: ["Arrays", "Interview Essentials"],
    description:
      "Given an integer array nums, return an array where answer[i] is the product of all elements except nums[i]. Do not use division.",
    examples: [
      {
        input: "nums = [1,2,3,4]",
        output: "[24,12,8,6]",
        explanation: "Prefix and suffix products avoid division.",
      },
    ],
    constraints: ["2 <= nums.length <= 10^5", "-30 <= nums[i] <= 30"],
    starterCode: buildStarterCode({
      functionName: "productExceptSelf",
      jsArgs: "nums",
      pyArgs: "nums",
      cppArgs: "vector<int>& nums",
      javaArgs: "int[] nums",
      cppReturnType: "vector<int>",
      javaReturnType: "int[]",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new int[0]",
    }),
    acceptanceRate: 52,
    companyTags: ["Amazon"],
    hints: ["Compute prefix and suffix arrays."],
    editorialSummary: "Two passes for left and right products.",
  }),
  buildProblem({
    title: "Top K Frequent Elements",
    difficulty: "medium",
    tags: ["hashing", "heaps"],
    categories: ["Heaps", "Interview Essentials"],
    description:
      "Given an integer array nums and an integer k, return the k most frequent elements.",
    examples: [
      {
        input: "nums = [1,1,1,2,2,3], k = 2",
        output: "[1,2]",
        explanation: "Frequencies are {1:3,2:2,3:1}.",
      },
    ],
    constraints: ["1 <= nums.length <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "topKFrequent",
      jsArgs: "nums, k",
      pyArgs: "nums, k",
      cppArgs: "vector<int>& nums, int k",
      javaArgs: "int[] nums, int k",
      cppReturnType: "vector<int>",
      javaReturnType: "int[]",
      jsReturnType: "array",
      pyReturnType: "array",
      javaReturnValue: "new int[0]",
    }),
    acceptanceRate: 51,
    companyTags: ["Google", "Amazon"],
    hints: ["Heap or bucket sort based on frequency."],
    editorialSummary: "Group by frequency and select top k.",
  }),
  buildProblem({
    title: "Subarray Sum Equals K",
    difficulty: "medium",
    tags: ["arrays", "hashing"],
    categories: ["Arrays", "Interview Essentials"],
    description:
      "Given an array of integers nums and an integer k, return the total number of subarrays whose sum equals k.",
    examples: [
      {
        input: "nums = [1,1,1], k = 2",
        output: "2",
        explanation: "Subarrays [1,1] at indices (0,1) and (1,2).",
      },
    ],
    constraints: ["1 <= nums.length <= 2 * 10^4", "-1000 <= nums[i] <= 1000"],
    starterCode: buildStarterCode({
      functionName: "subarraySum",
      jsArgs: "nums, k",
      pyArgs: "nums, k",
      cppArgs: "vector<int>& nums, int k",
      javaArgs: "int[] nums, int k",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 41,
    companyTags: ["Meta"],
    hints: ["Use prefix sums with a hash map of counts."],
    editorialSummary: "Count previous prefix sums that differ by k.",
  }),
  buildProblem({
    title: "Add Two Numbers",
    difficulty: "medium",
    tags: ["linked lists"],
    categories: ["Linked Lists"],
    description:
      "You are given two non-empty linked lists representing two non-negative integers. Add the two numbers and return the sum as a linked list.",
    examples: [
      {
        input: "l1 = [2,4,3], l2 = [5,6,4]",
        output: "[7,0,8]",
        explanation: "342 + 465 = 807.",
      },
    ],
    constraints: ["Each list has 1 to 100 nodes", "0 <= node value <= 9"],
    starterCode: buildStarterCode({
      functionName: "addTwoNumbers",
      jsArgs: "l1, l2",
      pyArgs: "l1, l2",
      cppArgs: "ListNode* l1, ListNode* l2",
      javaArgs: "ListNode l1, ListNode l2",
      cppReturnType: "ListNode*",
      javaReturnType: "ListNode",
      jsReturnType: "listnode",
      pyReturnType: "listnode",
      prefix: {
        cpp: listNodeDefs.cpp,
        java: listNodeDefs.java,
        python: listNodeDefs.python,
      },
      cppReturnValue: "nullptr",
      javaReturnValue: "null",
    }),
    acceptanceRate: 38,
    companyTags: ["Microsoft"],
    hints: ["Carry over when sum exceeds 9."],
    editorialSummary: "Simulate addition digit by digit.",
  }),
  buildProblem({
    title: "Number of Islands",
    difficulty: "medium",
    tags: ["graphs", "dfs", "bfs"],
    categories: ["Graphs", "Blind 75"],
    description:
      "Given a 2D grid of '1's and '0's, count the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.",
    examples: [
      {
        input: "grid = [[\"1\",\"1\",\"0\"],[\"1\",\"0\",\"0\"],[\"0\",\"0\",\"1\"]]",
        output: "2",
        explanation: "There are two separate islands.",
      },
    ],
    constraints: ["1 <= grid.length, grid[0].length <= 300"],
    starterCode: buildStarterCode({
      functionName: "numIslands",
      jsArgs: "grid",
      pyArgs: "grid",
      cppArgs: "vector<vector<char>>& grid",
      javaArgs: "char[][] grid",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 47,
    companyTags: ["Google"],
    hints: ["Mark visited cells to avoid recounting."],
    editorialSummary: "Run DFS/BFS from each land cell.",
  }),
  buildProblem({
    title: "Course Schedule",
    difficulty: "medium",
    tags: ["graphs", "topological sort"],
    categories: ["Graphs"],
    description:
      "There are numCourses courses you must take, labeled 0 to numCourses-1. Given prerequisites, determine if you can finish all courses.",
    examples: [
      {
        input: "numCourses = 2, prerequisites = [[1,0]]",
        output: "true",
        explanation: "Take 0 before 1.",
      },
    ],
    constraints: ["1 <= numCourses <= 2000"],
    starterCode: buildStarterCode({
      functionName: "canFinish",
      jsArgs: "numCourses, prerequisites",
      pyArgs: "numCourses, prerequisites",
      cppArgs: "int numCourses, vector<vector<int>>& prerequisites",
      javaArgs: "int numCourses, int[][] prerequisites",
      cppReturnType: "bool",
      javaReturnType: "boolean",
      jsReturnType: "boolean",
      pyReturnType: "boolean",
    }),
    acceptanceRate: 45,
    companyTags: ["Amazon"],
    hints: ["Detect cycle in a directed graph."],
    editorialSummary: "Topological sort or DFS cycle detection.",
  }),
  buildProblem({
    title: "Kth Largest Element in an Array",
    difficulty: "medium",
    tags: ["heaps", "arrays"],
    categories: ["Heaps"],
    description:
      "Given an integer array nums and an integer k, return the kth largest element in the array.",
    examples: [
      {
        input: "nums = [3,2,1,5,6,4], k = 2",
        output: "5",
        explanation: "The second largest element is 5.",
      },
    ],
    constraints: ["1 <= nums.length <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "findKthLargest",
      jsArgs: "nums, k",
      pyArgs: "nums, k",
      cppArgs: "vector<int>& nums, int k",
      javaArgs: "int[] nums, int k",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 49,
    companyTags: ["Google"],
    hints: ["Use a min-heap of size k."],
    editorialSummary: "Heap keeps the k largest elements.",
  }),
  buildProblem({
    title: "Search in Rotated Sorted Array",
    difficulty: "medium",
    tags: ["binary search", "arrays"],
    categories: ["Arrays"],
    description:
      "There is a sorted array that is rotated at an unknown pivot. Given target, return its index or -1.",
    examples: [
      {
        input: "nums = [4,5,6,7,0,1,2], target = 0",
        output: "4",
        explanation: "Binary search with pivot logic.",
      },
    ],
    constraints: ["1 <= nums.length <= 10^4", "-10^4 <= nums[i] <= 10^4"],
    starterCode: buildStarterCode({
      functionName: "search",
      jsArgs: "nums, target",
      pyArgs: "nums, target",
      cppArgs: "vector<int>& nums, int target",
      javaArgs: "int[] nums, int target",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 37,
    companyTags: ["Amazon", "Microsoft"],
    hints: ["One side is always sorted; decide which half to keep."],
    editorialSummary: "Modified binary search on rotated array.",
  }),
  buildProblem({
    title: "Decode String",
    difficulty: "medium",
    tags: ["stacks", "strings"],
    categories: ["Stacks"],
    description:
      "Given an encoded string, decode it. The encoding rule is k[encoded_string], where the encoded_string is repeated k times.",
    examples: [
      {
        input: "s = \"3[a]2[bc]\"",
        output: "aaabcbc",
        explanation: "Repeat substrings based on counts.",
      },
    ],
    constraints: ["1 <= s.length <= 10^5", "s contains digits and brackets"],
    starterCode: buildStarterCode({
      functionName: "decodeString",
      jsArgs: "s",
      pyArgs: "s",
      cppArgs: "string s",
      javaArgs: "String s",
      cppReturnType: "string",
      javaReturnType: "String",
      jsReturnType: "string",
      pyReturnType: "string",
    }),
    acceptanceRate: 51,
    companyTags: ["Amazon"],
    hints: ["Use stacks to track counts and previous strings."],
    editorialSummary: "Parse with a stack of frames.",
  }),
  buildProblem({
    title: "Coin Change",
    difficulty: "medium",
    tags: ["dynamic programming"],
    categories: ["Dynamic Programming", "Interview Essentials"],
    description:
      "Given coins of different denominations and a total amount, return the fewest number of coins needed. Return -1 if impossible.",
    examples: [
      {
        input: "coins = [1,2,5], amount = 11",
        output: "3",
        explanation: "11 = 5 + 5 + 1.",
      },
    ],
    constraints: ["1 <= coins.length <= 12", "0 <= amount <= 10^4"],
    starterCode: buildStarterCode({
      functionName: "coinChange",
      jsArgs: "coins, amount",
      pyArgs: "coins, amount",
      cppArgs: "vector<int>& coins, int amount",
      javaArgs: "int[] coins, int amount",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 39,
    companyTags: ["Uber"],
    hints: ["DP over amounts from 0..amount."],
    editorialSummary: "Classic unbounded knapsack variant.",
  }),
  buildProblem({
    title: "Longest Palindromic Substring",
    difficulty: "medium",
    tags: ["strings", "dynamic programming"],
    categories: ["Dynamic Programming", "Strings"],
    description:
      "Given a string s, return the longest palindromic substring.",
    examples: [
      {
        input: "s = \"babad\"",
        output: "\"bab\"",
        explanation: "\"aba\" is also valid.",
      },
    ],
    constraints: ["1 <= s.length <= 1000"],
    starterCode: buildStarterCode({
      functionName: "longestPalindrome",
      jsArgs: "s",
      pyArgs: "s",
      cppArgs: "string s",
      javaArgs: "String s",
      cppReturnType: "string",
      javaReturnType: "String",
      jsReturnType: "string",
      pyReturnType: "string",
    }),
    acceptanceRate: 34,
    companyTags: ["Amazon"],
    hints: ["Expand around centers or use DP table."],
    editorialSummary: "Track palindromes with expanding windows.",
  }),
  buildProblem({
    title: "Clone Graph",
    difficulty: "medium",
    tags: ["graphs", "hashing"],
    categories: ["Graphs"],
    description:
      "Given a reference to a node in a connected undirected graph, return a deep copy of the graph.",
    examples: [
      {
        input: "adjList = [[2,4],[1,3],[2,4],[1,3]]",
        output: "[[2,4],[1,3],[2,4],[1,3]]",
        explanation: "Clone each node and neighbors.",
      },
    ],
    constraints: ["1 <= number of nodes <= 100"],
    starterCode: buildStarterCode({
      functionName: "cloneGraph",
      jsArgs: "node",
      pyArgs: "node",
      cppArgs: "Node* node",
      javaArgs: "Node node",
      cppReturnType: "Node*",
      javaReturnType: "Node",
      jsReturnType: "object",
      pyReturnType: "object",
      cppReturnValue: "nullptr",
      javaReturnValue: "null",
      prefix: {
        cpp: graphNodeDefs.cpp,
        java: graphNodeDefs.java,
        python: graphNodeDefs.python,
      },
    }),
    acceptanceRate: 35,
    companyTags: ["Meta"],
    hints: ["Use a map from original to cloned node."],
    editorialSummary: "DFS/BFS while cloning neighbors.",
  }),
  buildProblem({
    title: "Minimum Window Substring",
    difficulty: "hard",
    tags: ["strings", "sliding window", "hashing"],
    categories: ["Strings", "Blind 75"],
    description:
      "Given strings s and t, return the minimum window in s which contains all the characters in t. If no such window exists, return an empty string.",
    examples: [
      {
        input: "s = \"ADOBECODEBANC\", t = \"ABC\"",
        output: "\"BANC\"",
        explanation: "The shortest substring containing A, B, and C.",
      },
    ],
    constraints: ["1 <= s.length, t.length <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "minWindow",
      jsArgs: "s, t",
      pyArgs: "s, t",
      cppArgs: "string s, string t",
      javaArgs: "String s, String t",
      cppReturnType: "string",
      javaReturnType: "String",
      jsReturnType: "string",
      pyReturnType: "string",
    }),
    acceptanceRate: 31,
    companyTags: ["Google", "Amazon"],
    hints: ["Keep counts for t and track how many are satisfied."],
    editorialSummary: "Sliding window with frequency deficits.",
  }),
  buildProblem({
    title: "Median of Two Sorted Arrays",
    difficulty: "hard",
    tags: ["binary search", "arrays"],
    categories: ["Arrays"],
    description:
      "Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays in O(log(m+n)) time.",
    examples: [
      {
        input: "nums1 = [1,3], nums2 = [2]",
        output: "2.0",
        explanation: "Merged array is [1,2,3].",
      },
    ],
    constraints: ["0 <= nums1.length <= 1000", "0 <= nums2.length <= 1000"],
    starterCode: buildStarterCode({
      functionName: "findMedianSortedArrays",
      jsArgs: "nums1, nums2",
      pyArgs: "nums1, nums2",
      cppArgs: "vector<int>& nums1, vector<int>& nums2",
      javaArgs: "int[] nums1, int[] nums2",
      cppReturnType: "double",
      javaReturnType: "double",
      jsReturnType: "number",
      pyReturnType: "number",
      cppReturnValue: "0.0",
      javaReturnValue: "0.0",
    }),
    acceptanceRate: 30,
    companyTags: ["Google"],
    hints: ["Binary search on partition boundaries."],
    editorialSummary: "Partition arrays to balance left/right halves.",
  }),
  buildProblem({
    title: "Serialize and Deserialize Binary Tree",
    difficulty: "hard",
    tags: ["trees", "graphs", "recursion"],
    categories: ["Trees"],
    description:
      "Design an algorithm to serialize and deserialize a binary tree. Ensure the encoded string can be decoded back to the original tree.",
    examples: [
      {
        input: "root = [1,2,3,null,null,4,5]",
        output: "[1,2,3,null,null,4,5]",
        explanation: "Use preorder or level order with null markers.",
      },
    ],
    constraints: ["Number of nodes is in the range [0, 10^4]"],
    starterCode: {
      javascript:
        "// Encodes a tree to a single string.\n" +
        "function serialize(root) {\n" +
        "  // TODO: implement\n" +
        "  return \"\";\n" +
        "}\n\n" +
        "// Decodes your encoded data to tree.\n" +
        "function deserialize(data) {\n" +
        "  // TODO: implement\n" +
        "  return null;\n" +
        "}\n",
      python:
        treeNodeDefs.python +
        "def serialize(root):\n" +
        "    # TODO: implement\n" +
        "    return \"\"\n\n" +
        "def deserialize(data):\n" +
        "    # TODO: implement\n" +
        "    return None\n",
      cpp:
        treeNodeDefs.cpp +
        "class Codec {\n" +
        "public:\n" +
        "    string serialize(TreeNode* root) {\n" +
        "        // TODO: implement\n" +
        "        return \"\";\n" +
        "    }\n\n" +
        "    TreeNode* deserialize(string data) {\n" +
        "        // TODO: implement\n" +
        "        return nullptr;\n" +
        "    }\n" +
        "};\n",
      java:
        treeNodeDefs.java +
        "class Codec {\n" +
        "    public String serialize(TreeNode root) {\n" +
        "        // TODO: implement\n" +
        "        return \"\";\n" +
        "    }\n\n" +
        "    public TreeNode deserialize(String data) {\n" +
        "        // TODO: implement\n" +
        "        return null;\n" +
        "    }\n" +
        "}\n",
    },
    acceptanceRate: 38,
    companyTags: ["Amazon"],
    hints: ["Store null markers to preserve structure."],
    editorialSummary: "Use preorder traversal with separators.",
  }),
  buildProblem({
    title: "Word Ladder",
    difficulty: "hard",
    tags: ["graphs", "bfs"],
    categories: ["Graphs"],
    description:
      "Given two words beginWord and endWord, return the length of the shortest transformation sequence from beginWord to endWord, changing one letter at a time.",
    examples: [
      {
        input: "beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\",\"cog\"]",
        output: "5",
        explanation: "hit -> hot -> dot -> dog -> cog",
      },
    ],
    constraints: ["1 <= wordList.length <= 5000"],
    starterCode: buildStarterCode({
      functionName: "ladderLength",
      jsArgs: "beginWord, endWord, wordList",
      pyArgs: "beginWord, endWord, wordList",
      cppArgs: "string beginWord, string endWord, vector<string>& wordList",
      javaArgs: "String beginWord, String endWord, java.util.List<String> wordList",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 28,
    companyTags: ["Google", "Meta"],
    hints: ["Build generic patterns to connect words."],
    editorialSummary: "BFS over implicit graph for shortest path.",
  }),
  buildProblem({
    title: "Edit Distance",
    difficulty: "hard",
    tags: ["dynamic programming"],
    categories: ["Dynamic Programming", "Blind 75"],
    description:
      "Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2.",
    examples: [
      {
        input: "word1 = \"horse\", word2 = \"ros\"",
        output: "3",
        explanation: "horse -> rorse -> rose -> ros",
      },
    ],
    constraints: ["0 <= word1.length, word2.length <= 500"],
    starterCode: buildStarterCode({
      functionName: "minDistance",
      jsArgs: "word1, word2",
      pyArgs: "word1, word2",
      cppArgs: "string word1, string word2",
      javaArgs: "String word1, String word2",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 33,
    companyTags: ["Amazon"],
    hints: ["DP over prefixes."],
    editorialSummary: "Classic Levenshtein DP table.",
  }),
  buildProblem({
    title: "Largest Rectangle in Histogram",
    difficulty: "hard",
    tags: ["stacks", "arrays"],
    categories: ["Stacks"],
    description:
      "Given an array of integers heights representing histogram bar heights, return the area of the largest rectangle in the histogram.",
    examples: [
      {
        input: "heights = [2,1,5,6,2,3]",
        output: "10",
        explanation: "Largest rectangle uses heights 5 and 6.",
      },
    ],
    constraints: ["1 <= heights.length <= 10^5"],
    starterCode: buildStarterCode({
      functionName: "largestRectangleArea",
      jsArgs: "heights",
      pyArgs: "heights",
      cppArgs: "vector<int>& heights",
      javaArgs: "int[] heights",
      cppReturnType: "int",
      javaReturnType: "int",
      jsReturnType: "number",
      pyReturnType: "number",
    }),
    acceptanceRate: 29,
    companyTags: ["Microsoft"],
    hints: ["Use a monotonic stack of indices."],
    editorialSummary: "Stack tracks next smaller bar boundaries.",
  }),
];

const ensureUniqueSlugs = (items) => {
  const used = new Map();

  return items.map((item) => {
    const base = item.slug || slugify(item.title);
    const count = used.get(base) || 0;
    used.set(base, count + 1);

    if (count === 0) {
      return { ...item, slug: base };
    }

    return { ...item, slug: `${base}-${count + 1}` };
  });
};

const problems = ensureUniqueSlugs(rawProblems);

const getProblems = () => problems;

module.exports = {
  getProblems,
};
